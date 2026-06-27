import { Check } from "lucide-react";
import type { Customer } from "@/lib/types";
import { STAGE_ORDER, STAGE_META, effectiveStage } from "@/lib/journey";
import { cn } from "@/lib/utils";

export function JourneyStepper({ c }: { c: Customer }) {
  const current = effectiveStage(c);
  const lost = current === "lost";
  // For a lost customer, show progress up to where they dropped (groupchat).
  const currentIdx = lost
    ? STAGE_ORDER.indexOf("groupchat")
    : STAGE_ORDER.indexOf(current);

  return (
    <div className="flex items-center">
      {STAGE_ORDER.map((stage, i) => {
        const meta = STAGE_META[stage];
        const done = i < currentIdx;
        const active = i === currentIdx;
        const reached = i <= currentIdx;
        return (
          <div key={stage} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                )}
                style={{
                  borderColor: reached ? meta.color : "var(--border)",
                  backgroundColor: reached
                    ? active
                      ? "var(--background)"
                      : meta.color
                    : "var(--background)",
                  color: active
                    ? meta.color
                    : done
                      ? "white"
                      : "var(--muted-foreground)",
                }}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "whitespace-nowrap text-[11px] font-medium",
                  reached ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {meta.label}
              </span>
            </div>
            {i < STAGE_ORDER.length - 1 && (
              <div
                className="mx-1 mb-5 h-0.5 flex-1 rounded-full"
                style={{
                  backgroundColor: i < currentIdx ? meta.color : "var(--border)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
