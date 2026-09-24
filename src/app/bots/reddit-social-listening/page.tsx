import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { RedditBotsManager } from "@/components/reddit-bots-manager";

export const dynamic = "force-dynamic";

export default function RedditSocialListeningPage() {
  return (
    <div>
      <PageHeader
        title="Reddit Social Listening"
        subtitle="Manage subreddits, keywords, and Shopify Community queries for this bot."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/bots">
            <ChevronLeft className="size-3.5" />
            All Bots
          </Link>
        </Button>
      </PageHeader>
      <div className="p-6">
        <RedditBotsManager />
      </div>
    </div>
  );
}
