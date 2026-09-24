import {
  Database,
  CreditCard,
  MessageCircle,
  Send,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import { getCustomers } from "@/lib/data";
import {
  sourceStatus,
  anyLiveSource,
  integrationConfig,
} from "@/lib/integrations/config";
import { PageHeader } from "@/components/page-header";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion-wrappers";
import { Card, CardContent } from "@/components/ui/card";

// Render per-request so live CRM status/data is always fresh.
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const customers = await getCustomers();
  const status = sourceStatus();
  const live = anyLiveSource();

  const grpBy = (p: string) =>
    customers.filter((c) => c.groupChat?.createdByBot && c.groupChat.platform === p);
  const msgsBy = (p: string) =>
    grpBy(p).reduce((s, c) => s + (c.groupChat?.messages?.length ?? 0), 0);
  const waGroups = grpBy("whatsapp").length;
  const waMessages = msgsBy("whatsapp");
  const tgGroups = grpBy("telegram").length;
  const tgMessages = msgsBy("telegram");
  const crmStaged = customers.filter((c) => c.crmStage).length;
  const payments = customers.filter((c) => c.onboarding?.paymentCustomerId).length;

  // WhatsApp worker connection state for the card subtitle.
  const waStore = integrationConfig.whatsapp.store;
  const waState =
    waStore?.status === "connected"
      ? `linked${waStore.me ? ` · ${waStore.me}` : ""}`
      : waStore?.status === "qr"
        ? "awaiting QR scan — run `pnpm whatsapp:link`"
        : "not linked — run `pnpm whatsapp:link`";

  // Telegram worker connection state.
  const tgStore = integrationConfig.telegram.store;
  const tgState =
    tgStore?.status === "connected"
      ? `connected${tgStore.me ? ` · ${tgStore.me}` : ""}`
      : "not running — run `pnpm telegram:sync`";

  const integrations = [
    {
      key: "crm" as const,
      icon: Database,
      phase: "Phase 1",
      name: "Apptics Sales CRM",
      source: "sales.apptics.org · REST + webhooks",
      color: "var(--stage-onboarding)",
      desc: "The spine — leads, pipeline stage, status (Open/Won/Lost), company & follow-up date. Read over the REST API; live updates via signed webhooks.",
      metric: `${crmStaged || customers.length} leads`,
      maps: "→ Customer (identity, stage)",
    },
    {
      key: "whatsapp" as const,
      icon: MessageCircle,
      phase: "Phase 2",
      name: "WhatsApp Groups",
      source: `QR-linked · whatsapp-web.js · ${waState}`,
      color: "var(--stage-groupchat)",
      desc: "Scan a QR to link the Apptics WhatsApp number — the app reads the sales-bot groups and their full conversations directly, matched to CRM leads by phone.",
      metric: `${waGroups} groups · ${waMessages} messages`,
      maps: "→ groupChat, messages, followUps",
    },
    {
      key: "telegram" as const,
      icon: Send,
      phase: "Phase 2b",
      name: "Telegram Groups",
      source: `gram.js session · ${tgState}`,
      color: "var(--stage-groupchat)",
      desc: "Reuses the saved Telegram session (no QR) to read the sales-bot Telegram groups + conversations, matched to CRM leads by handle or phone.",
      metric: `${tgGroups} groups · ${tgMessages} messages`,
      maps: "→ groupChat, messages, followUps",
    },
    {
      key: "apticsPay" as const,
      icon: CreditCard,
      phase: "Phase 3",
      name: "Apptics Pay",
      source: "pay.apptics.ai · CSV export",
      color: "var(--stage-won)",
      desc: "Merchant payment-onboarding applications & status (COMPLETED/IN_PROGRESS). Matched to CRM leads by email/phone.",
      metric: `${payments} payment onboardings`,
      maps: "→ Customer.onboarding (payment)",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle="Each source writes into one customer record. Flip a source live by adding its keys to .env.local."
      />

      <div className="space-y-6 p-6">
        <FadeIn><div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          {live ? (
            <>
              <span className="font-medium text-foreground">Live mode.</span> At
              least one real source is connected — the platform is aggregating
              live data and falling back to mock only where a source is offline.
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">
                Running on mock data.
              </span>{" "}
              Add a source&apos;s keys to{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                .env.local
              </code>{" "}
              (see{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                .env.local.example
              </code>
              ) to switch it live. Only{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                src/lib/integrations/
              </code>{" "}
              changes — the whole UI stays the same.
            </>
          )}
        </div></FadeIn>

        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((it) => {
            const isLive = status[it.key];
            return (
              <StaggerItem key={it.name}><Card>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span
                      className="flex size-10 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `color-mix(in oklch, ${it.color} 14%, transparent)`,
                        color: it.color,
                      }}
                    >
                      <it.icon className="size-5" />
                    </span>
                    {isLive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklch,var(--stage-won)_14%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--stage-won)]">
                        <CheckCircle2 className="size-3" />
                        Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        <CircleDashed className="size-3" />
                        Mock
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{it.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {it.phase}
                      </span>
                    </div>
                    <code className="text-[11px] text-muted-foreground">
                      {it.source}
                    </code>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {it.desc}
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3 text-xs">
                    <span className="font-medium">{it.metric}</span>
                    <code className="font-mono text-muted-foreground">
                      {it.maps}
                    </code>
                  </div>
                </CardContent>
              </Card></StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </div>
  );
}
