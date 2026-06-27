import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface BreakdownItem {
  key: string;
  label: string;
  value: number;
  /** Accent color for the bar fill + optional dot. */
  color?: string;
  icon?: React.ReactNode;
  href?: string;
}

/** A "Sources"-style panel: each row has a proportional bar fill behind it. */
export function BreakdownList({
  title,
  items,
  valueSuffix = "",
  empty = "No data yet",
}: {
  title: string;
  items: BreakdownItem[];
  valueSuffix?: string;
  empty?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
        )}
        {items.map((it) => {
          const pct = Math.max((it.value / max) * 100, 2);
          const color = it.color ?? "var(--muted-foreground)";
          return (
            <div
              key={it.key}
              className="relative flex items-center justify-between overflow-hidden rounded-md px-2.5 py-2 text-sm"
            >
              <span
                className="absolute inset-y-0.5 left-0 rounded-md"
                style={{
                  width: `${pct}%`,
                  backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`,
                }}
                aria-hidden
              />
              <span className="relative z-10 flex min-w-0 items-center gap-2">
                {it.icon ? (
                  <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                    {it.icon}
                  </span>
                ) : (
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span className="truncate">{it.label}</span>
              </span>
              <span className="relative z-10 shrink-0 pl-2 font-medium tabular-nums">
                {it.value.toLocaleString()}
                {valueSuffix}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
