import Link from "next/link";
import { sourceStatus, integrationConfig } from "@/lib/integrations/config";

/** Top-right connection indicator: how many integrations are live. */
export function ConnectionStatus() {
  const s = sourceStatus();
  const items: [string, boolean][] = [
    ["CRM", s.crm],
    ["WhatsApp", s.whatsapp],
    ["Telegram", s.telegram],
    ["Payments", s.apticsPay],
    ["Ads", integrationConfig.meta.enabled],
  ];
  const live = items.filter(([, v]) => v).length;
  const ok = live > 0;
  const title = items
    .map(([n, v]) => `${n}: ${v ? "connected" : "offline"}`)
    .join("  ·  ");

  return (
    <Link
      href="/integrations"
      title={title}
      className="inline-flex items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <span className="relative flex size-2">
        {ok && (
          <span
            className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
            style={{ backgroundColor: "var(--stage-won)" }}
          />
        )}
        <span
          className="relative inline-flex size-2 rounded-full"
          style={{
            backgroundColor: ok ? "var(--stage-won)" : "var(--muted-foreground)",
          }}
        />
      </span>
      {live}/{items.length} connected
    </Link>
  );
}
