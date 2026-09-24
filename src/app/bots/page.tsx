import Link from "next/link";
import { Radar, MessageSquare, CheckCircle2, CircleDashed, ChevronRight, Link2, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StaggerContainer, StaggerItem } from "@/components/motion-wrappers";
import { Card, CardContent } from "@/components/ui/card";
import { integrationConfig } from "@/lib/integrations/config";

export const dynamic = "force-dynamic";

const X_BOT_URL = process.env.X_BOT_URL || "http://localhost:3001";
const X_BOT_API_KEY = process.env.X_BOT_API_KEY || "";
const REDDIT_BOT_URL = process.env.REDDIT_BOT_URL || "http://localhost:3002";
const REDDIT_BOT_API_KEY = process.env.REDDIT_BOT_API_KEY || "";

function authHeaders(apiKey: string) {
  const h: Record<string, string> = {};
  if (apiKey) h["Authorization"] = `Bearer ${apiKey}`;
  return h;
}

async function loadWatchers() {
  try {
    const res = await fetch(`${X_BOT_URL}/api/watchers`, {
      headers: authHeaders(X_BOT_API_KEY),
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function loadRedditSources() {
  try {
    const res = await fetch(`${REDDIT_BOT_URL}/api/sources`, {
      headers: authHeaders(REDDIT_BOT_API_KEY),
      cache: "no-store",
    });
    if (!res.ok) return { redditSources: [], accounts: [] };
    return await res.json();
  } catch {
    return { redditSources: [], accounts: [] };
  }
}

async function loadSalesBot() {
  const { url, apiKey, enabled } = integrationConfig.salesBot;
  if (!enabled) return { whatsapp: null, telegram: null };
  try {
    const res = await fetch(`${url}/login/status`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) return { whatsapp: null, telegram: null };
    return await res.json();
  } catch {
    return { whatsapp: null, telegram: null };
  }
}

export default async function BotsPage() {
  const [watchers, redditSources, salesBot] = await Promise.all([
    loadWatchers(),
    loadRedditSources(),
    loadSalesBot(),
  ]);

  const waLinked = !!salesBot?.whatsapp?.connected;
  const tgLinked = salesBot?.telegram?.status === "connected";

  const activeWatchers = (watchers as { chatId: string; queries: string[] }[]).filter(
    (w) => w.chatId && w.chatId !== "REPLACE_WITH_CHAT_ID",
  );
  const xKeywords = (watchers as { queries: string[] }[]).reduce(
    (s, w) => s + w.queries.length,
    0,
  );
  const xBotLive = watchers.length > 0;

  const redditSubreddits = redditSources.redditSources ?? [];
  const redditKeywords = redditSubreddits.reduce(
    (s: number, r: { queries: string[] }) => s + r.queries.length,
    0,
  );
  const redditAccounts = redditSources.accounts ?? [];
  const redditBotLive = redditSubreddits.length > 0;

  const bots = [
    {
      slug: "x-social-listening",
      icon: Radar,
      name: "X Social Listening",
      source: "Apify · LLM · Telegram",
      color: "var(--primary)",
      desc: "Monitors X (Twitter) for high-intent tweets matching each watcher's keywords. Filters through an LLM and delivers qualified leads to Telegram every 3 hours.",
      live: xBotLive,
      metric: `${activeWatchers.length}/${watchers.length} watchers · ${xKeywords} keywords`,
    },
    {
      slug: "reddit-social-listening",
      icon: MessageSquare,
      name: "Reddit Social Listening",
      source: "Camoufox · Claude · Telegram",
      color: "#ff4500",
      desc: "Monitors Reddit subreddits and Shopify Community forums. Signs in via Camoufox to reply to leads. Claude agent qualifies and generates replies.",
      live: redditBotLive,
      metric: `${redditSubreddits.length} subreddits · ${redditAccounts.length} accounts · ${redditKeywords} keywords`,
    },
    {
      slug: "accounts",
      icon: Link2,
      name: "Sales Bot Accounts",
      source: "whatsapp-web.js · gram.js · QR",
      color: "#22c55e",
      desc: "Link the WhatsApp & Telegram numbers that create the group chats and send booked-call notifications. Scan a QR to swap in a new number.",
      live: waLinked || tgLinked,
      metric: `WhatsApp ${waLinked ? "linked" : "off"} · Telegram ${tgLinked ? "linked" : "off"}`,
    },
    {
      slug: "automations",
      icon: SlidersHorizontal,
      name: "Bot Automations",
      source: "reminders · follow-ups · quiet hours",
      color: "#8b5cf6",
      desc: "Customize the sales-bot flow — group-chat delay + welcome, pre-call reminders, follow-ups, no-show messages, and quiet hours.",
      live: waLinked || tgLinked,
      metric: "Edit timings & message templates",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bots"
        subtitle="Automated listening and outreach bots. Click a bot to configure."
      />

      <div className="space-y-6 p-6">
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <StaggerItem key={bot.slug}>
            <Link href={`/bots/${bot.slug}`}>
              <Card className="h-full transition-colors hover:border-foreground/20">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span
                      className="flex size-10 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `color-mix(in oklch, ${bot.color} 14%, transparent)`,
                        color: bot.color,
                      }}
                    >
                      <bot.icon className="size-5" />
                    </span>
                    <div className="flex items-center gap-2">
                      {bot.live ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklch,var(--stage-won,#22c55e)_14%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--stage-won,#22c55e)]">
                          <CheckCircle2 className="size-3" />
                          Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          <CircleDashed className="size-3" />
                          Not configured
                        </span>
                      )}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold">{bot.name}</span>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {bot.desc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t pt-3 text-xs">
                    <span className="font-medium">{bot.metric}</span>
                    <code className="font-mono text-muted-foreground">
                      {bot.source}
                    </code>
                  </div>
                </CardContent>
              </Card>
            </Link>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </div>
  );
}
