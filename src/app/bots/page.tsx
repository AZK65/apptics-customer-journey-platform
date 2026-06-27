import Link from "next/link";
import { Radar, CheckCircle2, CircleDashed, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

interface Watcher {
  name: string;
  chatId: string;
  queries: string[];
}

async function loadWatchers(): Promise<Watcher[]> {
  const dir = process.env.SOCIAL_LISTENING_DIR;
  if (!dir) return [];
  try {
    const raw = await readFile(join(dir, "watchers.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default async function BotsPage() {
  const watchers = await loadWatchers();
  const activeWatchers = watchers.filter(
    (w) => w.chatId && w.chatId !== "REPLACE_WITH_CHAT_ID",
  );
  const totalKeywords = watchers.reduce((s, w) => s + w.queries.length, 0);
  const xBotLive = watchers.length > 0;

  const bots = [
    {
      slug: "x-social-listening",
      icon: Radar,
      name: "X Social Listening",
      source: "Apify scraper · OpenRouter LLM · Telegram alerts",
      color: "var(--primary)",
      desc: "Monitors X (Twitter) for high-intent tweets matching each watcher's keywords. Filters through an LLM and delivers qualified leads to Telegram every 3 hours.",
      live: xBotLive,
      metric: `${activeWatchers.length}/${watchers.length} watchers · ${totalKeywords} keywords`,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bots"
        subtitle="Automated listening and outreach bots. Click a bot to configure."
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <Link key={bot.slug} href={`/bots/${bot.slug}`}>
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
          ))}
        </div>
      </div>
    </div>
  );
}
