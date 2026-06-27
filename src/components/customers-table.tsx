"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { Customer, Stage } from "@/lib/types";
import {
  effectiveStage,
  STAGE_META,
  STAGE_ORDER,
  SOURCE_META,
  SERVICE_META,
  formatCurrency,
  relativeTime,
} from "@/lib/journey";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CustomerAvatar } from "@/components/customer-avatar";
import { StageBadge } from "@/components/stage-badge";
import { DynamicIcon } from "@/components/lucide";
import { cn } from "@/lib/utils";

const FILTERS: (Stage | "all")[] = ["all", ...STAGE_ORDER, "lost"];

export function CustomersTable({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Stage | "all">("all");

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return customers
      .map((c) => ({ c, stage: effectiveStage(c) }))
      .filter(({ c, stage }) => {
        if (filter !== "all" && stage !== filter) return false;
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => +new Date(b.c.updatedAt) - +new Date(a.c.updatedAt));
  }, [customers, query, filter]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: customers.length };
    for (const c of customers) {
      const s = effectiveStage(c);
      m[s] = (m[s] ?? 0) + 1;
    }
    return m;
  }, [customers]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, company, email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {f === "all" ? "All" : STAGE_META[f].label}
              <span className="ml-1 opacity-60">{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="hidden lg:table-cell">Services</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                Updated
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ c, stage }) => {
              const src = SOURCE_META[c.attribution.source];
              return (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/customers/${c.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CustomerAvatar
                        name={c.name}
                        color={c.avatarColor}
                        className="size-8"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{c.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {c.company}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StageBadge stage={stage} />
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <DynamicIcon name={src.icon} className="size-3.5" />
                      {src.label}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {c.services.slice(0, 2).map((s) => (
                        <span
                          key={s}
                          className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {SERVICE_META[s]}
                        </span>
                      ))}
                      {c.services.length > 2 && (
                        <span className="text-[11px] text-muted-foreground">
                          +{c.services.length - 2}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {c.dealValue > 0 ? formatCurrency(c.dealValue) : "—"}
                  </TableCell>
                  <TableCell className="hidden text-right text-xs text-muted-foreground sm:table-cell">
                    {relativeTime(c.updatedAt)}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No customers match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
