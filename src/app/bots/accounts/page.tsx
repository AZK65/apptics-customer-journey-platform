import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SalesAccountsManager } from "@/components/sales-accounts-manager";

export const dynamic = "force-dynamic";

export default function SalesAccountsPage() {
  return (
    <div>
      <PageHeader
        title="Sales Bot Accounts"
        subtitle="Link the WhatsApp & Telegram numbers that create group chats and send booked-call notifications. Scan each QR from the phone you want to use."
      />
      <div className="space-y-5 p-6">
        <Link
          href="/bots"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Bots
        </Link>
        <SalesAccountsManager />
      </div>
    </div>
  );
}
