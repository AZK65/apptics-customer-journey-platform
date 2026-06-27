"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const RANGES: [string, string][] = [
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["90d", "90 days"],
  ["all", "All time"],
];

export function RangeSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get("range") || "all";

  const set = (r: string) => {
    const p = new URLSearchParams(sp);
    p.set("range", r);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5">
      {RANGES.map(([id, label]) => (
        <button
          key={id}
          onClick={() => set(id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            current === id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
