import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BotsManager } from "@/components/bots-manager";

export const dynamic = "force-dynamic";

export default function XSocialListeningPage() {
  return (
    <div>
      <PageHeader
        title="X Social Listening"
        subtitle="Manage watchers, keywords, and Telegram delivery for this bot."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/bots">
            <ChevronLeft className="size-3.5" />
            All Bots
          </Link>
        </Button>
      </PageHeader>
      <div className="p-6">
        <BotsManager />
      </div>
    </div>
  );
}
