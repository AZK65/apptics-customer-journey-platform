import Link from "next/link";
import { getCustomers } from "@/lib/data";
import {
  computeFunnel,
  conversionRate,
  effectiveStage,
  hasReached,
  buildLeadSeries,
  countryFromPhone,
  STAGE_META,
  STAGE_ORDER,
  SOURCE_META,
  SERVICE_META,
  relativeTime,
  buildTimeline,
} from "@/lib/journey";
import type { LeadSource, ServiceKind, Stage } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerAvatar } from "@/components/customer-avatar";
import { StageBadge } from "@/components/stage-badge";
import { DynamicIcon } from "@/components/lucide";
import { LeadsAreaChart } from "@/components/leads-area-chart";
import { BreakdownList, type BreakdownItem } from "@/components/breakdown-list";
import { RangeSwitcher } from "@/components/range-switcher";

export const dynamic = "force-dynamic";

const RANGE_DAYS: Record<string, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const all = await getCustomers();
  const { range: raw } = await searchParams;
  const range = raw && raw in RANGE_DAYS ? raw : "all";
  const days = RANGE_DAYS[range];

  // Scope everything to the selected range, anchored to the latest lead.
  const maxTs = all.length
    ? Math.max(...all.map((c) => +new Date(c.createdAt)))
    : Date.now();
  const customers = days
    ? all.filter((c) => +new Date(c.createdAt) >= maxTs - (days - 1) * 86_400_000)
    : all;

  const funnel = computeFunnel(customers);
  const conv = conversionRate(funnel);
  const minTs = customers.length
    ? Math.min(...customers.map((c) => +new Date(c.createdAt)))
    : maxTs;
  const seriesDays =
    days ?? Math.min(180, Math.max(7, Math.ceil((maxTs - minTs) / 86_400_000) + 1));
  const series = buildLeadSeries(customers, seriesDays);

  const total = customers.length;
  const booked = customers.filter((c) => hasReached(c, "booked")).length;
  const won = customers.filter((c) => effectiveStage(c) === "won").length;
  const lost = customers.filter((c) => effectiveStage(c) === "lost").length;

  const kpis = [
    { label: "Total Leads", value: total.toLocaleString() },
    { label: "Booked", value: booked.toLocaleString() },
    { label: "Won", value: won.toLocaleString() },
    { label: "Lost", value: lost.toLocaleString() },
    { label: "Win Rate", value: `${(conv * 100).toFixed(1)}%` },
  ];

  // ── Breakdowns ──────────────────────────────────────────────────────────────
  const tally = <K extends string>(keys: (K | undefined | null)[]) => {
    const m = new Map<K, number>();
    for (const k of keys) if (k) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };

  const sourceItems: BreakdownItem[] = [...tally(customers.map((c) => c.attribution.source)).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([src, value]) => ({
      key: src,
      label: SOURCE_META[src as LeadSource].label,
      value,
      color: "var(--stage-source)",
      icon: <DynamicIcon name={SOURCE_META[src as LeadSource].icon} className="size-3.5" />,
    }));

  const stageItems: BreakdownItem[] = [...STAGE_ORDER, "lost" as Stage]
    .map((stage) => ({
      key: stage,
      label: STAGE_META[stage].label,
      value: customers.filter((c) => effectiveStage(c) === stage).length,
      color: STAGE_META[stage].color,
    }))
    .filter((i) => i.value > 0);

  const serviceItems: BreakdownItem[] = [...tally(customers.flatMap((c) => c.services)).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([svc, value]) => ({
      key: svc,
      label: SERVICE_META[svc as ServiceKind],
      value,
      color: "var(--stage-onboarding)",
    }));

  const campaignItems: BreakdownItem[] = [
    ...tally(customers.map((c) => c.attribution.ad?.campaignName ?? c.attribution.campaign)).entries(),
  ]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ key: name, label: name, value, color: "var(--stage-won)" }));

  // Geography — derived from each lead's phone calling code.
  const geo = new Map<string, { value: number; flag: string }>();
  for (const c of customers) {
    const co = countryFromPhone(c.phone);
    if (!co) continue;
    const e = geo.get(co.name) ?? { value: 0, flag: co.flag };
    e.value += 1;
    geo.set(co.name, e);
  }
  const geoItems: BreakdownItem[] = [...geo.entries()]
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 8)
    .map(([name, e]) => ({
      key: name,
      label: name,
      value: e.value,
      color: "var(--stage-meeting)",
      icon: <span className="text-sm leading-none">{e.flag}</span>,
    }));

  const deviceItems: BreakdownItem[] = [...tally(customers.map((c) => c.device)).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([d, value]) => ({ key: d, label: d, value, color: "var(--stage-booked)" }));

  // Recent activity
  const recent = customers
    .flatMap((c) => buildTimeline(c).slice(-1).map((e) => ({ c, e })))
    .sort((a, b) => +new Date(b.e.at) - +new Date(a.e.at))
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle={`Lead flow across the journey — ${
          days ? `last ${days} days` : "all time"
        }.`}
      >
        <RangeSwitcher />
      </PageHeader>

      <div className="space-y-6 p-6">
        {/* KPI row — borderless big numbers, hairline dividers */}
        <div className="flex flex-wrap divide-x divide-y overflow-hidden rounded-xl border bg-card sm:divide-y-0">
          {kpis.map((k) => (
            <div key={k.label} className="min-w-[7.5rem] flex-1 px-5 py-4">
              <div className="text-sm text-muted-foreground">{k.label}</div>
              <div className="mt-1 text-3xl font-semibold tracking-tight">
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* Hero area chart */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Leads over time</CardTitle>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: "#8b5cf6" }} />
                New leads
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
                Won
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {series.length > 0 ? (
              <LeadsAreaChart data={series} />
            ) : (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                No lead activity in this range.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Breakdown panels — Framer "Sources / Pages" style */}
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownList title="Where leads come from" items={sourceItems} />
          <BreakdownList title="Pipeline stages" items={stageItems} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownList title="Services requested" items={serviceItems} />
          <BreakdownList
            title="Ad campaigns"
            items={campaignItems}
            empty="No ad-attributed leads yet — tag your ads to populate this."
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownList title="Geography" items={geoItems} />
          <BreakdownList
            title="Devices"
            items={deviceItems}
            empty="No device data yet — captured at booking once the form is live."
          />
        </div>

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {recent.map(({ c, e }) => (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
              >
                <CustomerAvatar name={c.name} color={c.avatarColor} className="size-8" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{c.company}</span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{e.title}</div>
                </div>
                <StageBadge stage={effectiveStage(c)} />
                <span className="hidden w-14 text-right text-xs text-muted-foreground sm:block">
                  {relativeTime(e.at)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
