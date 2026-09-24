import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { BotAutomationsManager } from "@/components/bot-automations-manager";

export const dynamic = "force-dynamic";

export default function BotAutomationsPage() {
  return (
    <div>
      <PageHeader
        title="Bot Automations"
        subtitle="Customize the WhatsApp/Telegram sales-bot flow — when the group is created, reminders, follow-ups, no-show messages, and quiet hours."
      />
      <div className="space-y-5 p-6">
        <Link
          href="/bots"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Bots
        </Link>
        <div className="max-w-3xl">
          <BotAutomationsManager />
        </div>
      </div>
    </div>
  );
}
