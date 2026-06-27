"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarRange, Layers } from "lucide-react";
import type { Customer, Stage } from "@/lib/types";
import {
  effectiveStage,
  hasReached,
  STAGE_ORDER,
  STAGE_META,
  formatCurrency,
  relativeTime,
  SOURCE_META,
} from "@/lib/journey";
import { CustomerAvatar } from "@/components/customer-avatar";
import { StageBadge } from "@/components/stage-badge";
import { DynamicIcon } from "@/components/lucide";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Journey funnel (Sankey).
//
// Driven by the canonical `effectiveStage`, so it stays consistent with the
// dashboard funnel and the customers table on whatever data is live. The spine
// is the pipeline (New Lead → … → Won); the ribbon narrows as customers drop
// off, with a Lost branch off the top. Operational sub-branches (no-show,
// follow-ups, …) layer back in once Phase 2 supplies booking/meeting events.
// ─────────────────────────────────────────────────────────────────────────────

type NodeId = Stage; // "source" | … | "won" | "lost"

const NODE_DESC: Record<NodeId, string> = {
  source: "Every captured lead — the top of the funnel.",
  booked: "Reached the booked-call stage (Cal.com).",
  groupchat: "A group chat has been spun up for them.",
  meeting: "Reached the meeting stage.",
  onboarding: "Filling onboarding forms (CRM or payment).",
  won: "Fully onboarded & paying.",
  lost: "Dropped out of the pipeline.",
};

// ── Time range filter ────────────────────────────────────────────────────────
const NOW = new Date("2026-06-24T18:00:00Z");
const RANGES: { id: string; label: string; days: number | null }[] = [
  { id: "all", label: "All time", days: null },
  { id: "90d", label: "90 days", days: 90 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "7d", label: "7 days", days: 7 },
];

// ── Layout constants ─────────────────────────────────────────────────────────
const PILL_W = 150;
const COL_GAP = 92;
const START_Y = 24;
const USABLE_H = 520;
const PAD_X = 16;
const LOST_GAP = 34;

export function JourneySankey({ customers }: { customers: Customer[] }) {
  const [range, setRange] = useState("all");
  const [hovered, setHovered] = useState<NodeId | null>(null);
  const [modalStage, setModalStage] = useState<NodeId | null>(null);

  const filtered = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days;
    if (!days) return customers;
    const cutoff = +NOW - days * 86_400_000;
    return customers.filter((c) => +new Date(c.createdAt) >= cutoff);
  }, [customers, range]);

  const { nodes, ribbons, width, height, members, counts } = useMemo(() => {
    const total = filtered.length;
    const unit = USABLE_H / (total || 1);

    // Members per node.
    const members: Record<string, Customer[]> = {};
    members.source = filtered; // everyone is a lead
    for (let i = 1; i < STAGE_ORDER.length; i++) {
      const stage = STAGE_ORDER[i];
      members[stage] = filtered.filter((c) => hasReached(c, stage));
    }
    members.lost = filtered.filter((c) => effectiveStage(c) === "lost");

    const reached = STAGE_ORDER.map((s) => members[s].length);
    const lostCount = members.lost.length;
    const counts = { reached, lost: lostCount, total };

    // Spine nodes (top-aligned so the funnel narrows downward).
    const nodes: Record<
      string,
      { id: NodeId; label: string; color: string; x: number; y: number; w: number; h: number; count: number }
    > = {};
    STAGE_ORDER.forEach((stage, i) => {
      const count = reached[i];
      nodes[stage] = {
        id: stage,
        label: STAGE_META[stage].label,
        color: STAGE_META[stage].color,
        x: PAD_X + i * (PILL_W + COL_GAP),
        y: START_Y,
        w: PILL_W,
        h: count > 0 ? Math.max(count * unit, 24) : 0,
        count,
      };
    });

    // Lost node hangs below the "booked" column.
    const booked = nodes[STAGE_ORDER[1]];
    nodes.lost = {
      id: "lost",
      label: STAGE_META.lost.label,
      color: STAGE_META.lost.color,
      x: booked.x,
      y: booked.y + (booked.h || 24) + LOST_GAP,
      w: PILL_W,
      h: lostCount > 0 ? Math.max(lostCount * unit, 24) : 0,
      count: lostCount,
    };

    // Ribbons.
    type Ribbon = { key: string; from: NodeId; to: NodeId; d: string; color: string };
    const ribbons: Ribbon[] = [];
    const ribbon = (from: (typeof nodes)[string], to: (typeof nodes)[string], p0: number) => {
      const p1 = p0 + to.h;
      const c0 = to.y;
      const c1 = to.y + to.h;
      const x1 = from.x + from.w;
      const x2 = to.x;
      const mx = (x1 + x2) / 2;
      return `M ${x1} ${p0} C ${mx} ${p0}, ${mx} ${c0}, ${x2} ${c0} L ${x2} ${c1} C ${mx} ${c1}, ${mx} ${p1}, ${x1} ${p1} Z`;
    };

    // Forward spine: each ribbon = those who advanced to the next stage.
    for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
      const from = nodes[STAGE_ORDER[i]];
      const to = nodes[STAGE_ORDER[i + 1]];
      if (!from.h || !to.h) continue;
      ribbons.push({
        key: `${from.id}-${to.id}`,
        from: from.id,
        to: to.id,
        color: to.color,
        d: ribbon(from, to, from.y),
      });
    }

    // Lost branch off New Lead (slice sits below the forward slice).
    if (nodes.lost.h) {
      const from = nodes.source;
      const forwardH = nodes[STAGE_ORDER[1]].h;
      ribbons.push({
        key: "source-lost",
        from: "source",
        to: "lost",
        color: nodes.lost.color,
        d: ribbon(from, nodes.lost, from.y + forwardH),
      });
    }

    const width = PAD_X * 2 + STAGE_ORDER.length * PILL_W + (STAGE_ORDER.length - 1) * COL_GAP;
    const height = Math.max(nodes.lost.y + nodes.lost.h, START_Y + USABLE_H) + 12;

    return { nodes, ribbons, width, height, members, counts };
  }, [filtered]);

  const order: NodeId[] = [...STAGE_ORDER, "lost"];

  // ── KPIs (all real on CRM data) ─────────────────────────────────────────────
  const total = counts.total;
  const conv = total ? Math.round((counts.reached[5] / total) * 100) : 0;
  const kpis = [
    { label: "Total Leads", value: total },
    { label: "Reached Booked", value: counts.reached[1] },
    { label: "Won", value: counts.reached[5] },
    { label: "Lost", value: counts.lost },
  ];

  // ── Modal ───────────────────────────────────────────────────────────────────
  const modalList = modalStage
    ? (members[modalStage] ?? [])
        .slice()
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    : [];
  const modalValue = modalList.reduce((s, c) => s + c.dealValue, 0);
  const modalSources = Object.entries(
    modalList.reduce<Record<string, number>>((acc, c) => {
      acc[c.attribution.source] = (acc[c.attribution.source] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Toolbar: time-range filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarRange className="size-4" />
          Showing leads from
        </p>
        <div className="inline-flex rounded-lg border bg-card p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                range === r.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="mt-0.5 text-xl font-semibold tracking-tight">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Sankey — full width */}
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        {total === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <Layers className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No leads in this time range. Try widening the filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ width: "100%", minWidth: 880, height: "auto" }}
            >
              {ribbons.map((r) => {
                const active = hovered == null || hovered === r.from || hovered === r.to;
                return (
                  <path
                    key={r.key}
                    d={r.d}
                    fill={`color-mix(in oklch, ${r.color} ${active ? 34 : 13}%, transparent)`}
                    className="transition-all duration-200"
                  />
                );
              })}

              {order.map((id) => {
                const n = nodes[id];
                if (!n || n.count === 0) return null;
                const isHot = hovered === id;
                const twoLines = n.h >= 42;
                return (
                  <g
                    key={id}
                    transform={`translate(${n.x}, ${n.y})`}
                    className="cursor-pointer"
                    onClick={() => setModalStage(id)}
                    onMouseEnter={() => setHovered(id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <rect
                      width={n.w}
                      height={n.h}
                      rx={9}
                      fill={`color-mix(in oklch, ${n.color} ${isHot ? 22 : 12}%, var(--card))`}
                      stroke={isHot ? n.color : `color-mix(in oklch, ${n.color} 40%, transparent)`}
                      strokeWidth={isHot ? 2.5 : 1}
                      className="transition-all duration-150"
                    />
                    <rect width={5} height={n.h} rx={2.5} fill={n.color} />
                    {twoLines ? (
                      <>
                        <text x={16} y={n.h / 2 - 4} className="fill-foreground text-[13px] font-semibold">
                          {n.label}
                        </text>
                        <text x={16} y={n.h / 2 + 14} className="fill-muted-foreground text-[12px]">
                          {n.count} {n.count === 1 ? "customer" : "customers"}
                        </text>
                      </>
                    ) : (
                      <text x={16} y={n.h / 2 + 4} className="fill-foreground text-[13px] font-semibold">
                        {n.label}
                        <tspan className="fill-muted-foreground font-normal"> · {n.count}</tspan>
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
        <p className="mt-3 px-1 text-xs text-muted-foreground">
          Ribbon thickness = number of customers.{" "}
          <span className="font-medium text-foreground">Click any stage</span> to
          preview who&apos;s in it. The ribbon narrows as leads drop off; the Lost
          branch peels off the top. Booking / meeting / payment detail fills in as
          those sources come online.
        </p>
      </div>

      {/* Stage preview modal */}
      <Dialog open={modalStage !== null} onOpenChange={(o) => !o && setModalStage(null)}>
        <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {modalStage && (
            <>
              <DialogHeader className="space-y-3 border-b px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: STAGE_META[modalStage].color }}
                  />
                  <DialogTitle className="text-lg">
                    {STAGE_META[modalStage].label}
                  </DialogTitle>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {modalList.length} {modalList.length === 1 ? "customer" : "customers"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{NODE_DESC[modalStage]}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {modalValue > 0 && (
                    <span className="rounded-lg bg-muted px-2.5 py-1 text-xs">
                      <span className="font-semibold text-foreground">
                        {formatCurrency(modalValue)}
                      </span>{" "}
                      <span className="text-muted-foreground">total value</span>
                    </span>
                  )}
                  {modalSources.slice(0, 3).map(([src, n]) => {
                    const meta = SOURCE_META[src as keyof typeof SOURCE_META];
                    return (
                      <span
                        key={src}
                        className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        <DynamicIcon name={meta.icon} className="size-3" />
                        {meta.label} · {n}
                      </span>
                    );
                  })}
                </div>
              </DialogHeader>

              <div className="max-h-[55vh] space-y-2 overflow-y-auto px-4 py-4">
                {modalList.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No customers in this stage for the selected range.
                  </p>
                ) : (
                  modalList.map((c) => {
                    const src = SOURCE_META[c.attribution.source];
                    return (
                      <Link
                        key={c.id}
                        href={`/customers/${c.id}`}
                        onClick={() => setModalStage(null)}
                        className="group flex items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-sm hover:ring-1 hover:ring-ring/40"
                      >
                        <CustomerAvatar name={c.name} color={c.avatarColor} className="size-9" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{c.name}</span>
                            {c.dealValue > 0 && (
                              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                                {formatCurrency(c.dealValue)}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                            <DynamicIcon name={src.icon} className="size-3 shrink-0" />
                            <span className="truncate">{c.company}</span>
                            <span>·</span>
                            <span className="shrink-0">{relativeTime(c.updatedAt)}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StageBadge stage={effectiveStage(c)} />
                          <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
