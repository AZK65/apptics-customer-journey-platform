"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { SeriesPoint } from "@/lib/journey";
import { formatDayShort } from "@/lib/journey";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const config = {
  leads: { label: "New leads", color: "#8b5cf6" }, // violet
  won: { label: "Won", color: "#3b82f6" }, // blue
} satisfies ChartConfig;

export function LeadsAreaChart({ data }: { data: SeriesPoint[] }) {
  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillLeads" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-leads)" stopOpacity={0.5} />
            <stop offset="95%" stopColor="var(--color-leads)" stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id="fillWon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-won)" stopOpacity={0.45} />
            <stop offset="95%" stopColor="var(--color-won)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={28}
          tickFormatter={formatDayShort}
          className="text-xs"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
          className="text-xs"
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={
            <ChartTooltipContent
              labelFormatter={(v) => formatDayShort(String(v))}
              indicator="dot"
            />
          }
        />
        <Area
          dataKey="leads"
          type="natural"
          fill="url(#fillLeads)"
          stroke="var(--color-leads)"
          strokeWidth={2}
          stackId="a"
        />
        <Area
          dataKey="won"
          type="natural"
          fill="url(#fillWon)"
          stroke="var(--color-won)"
          strokeWidth={2}
          stackId="b"
        />
      </AreaChart>
    </ChartContainer>
  );
}
