import Link from "next/link";
import {
  CalendarCheck,
  Video,
  CircleSlash,
  FileCheck2,
  MessageCircle,
  Bot,
} from "lucide-react";
import type { Customer } from "@/lib/types";
import {
  SERVICE_META,
  PLATFORM_META,
  SOURCE_META,
  formatCurrency,
  relativeTime,
} from "@/lib/journey";
import { CustomerAvatar } from "@/components/customer-avatar";
import { DynamicIcon } from "@/components/lucide";

/** Compact signal chips showing which integrations have fired for this customer. */
function Signals({ c }: { c: Customer }) {
  const items: { icon: React.ReactNode; label: string; tone: string }[] = [];

  if (c.booking) {
    items.push({
      icon: <CalendarCheck className="size-3" />,
      label: "Booked",
      tone: "var(--stage-booked)",
    });
  }
  if (c.groupChat) {
    items.push({
      icon: c.groupChat.createdByBot ? (
        <Bot className="size-3" />
      ) : (
        <MessageCircle className="size-3" />
      ),
      label: PLATFORM_META[c.groupChat.platform].label,
      tone: "var(--stage-groupchat)",
    });
  }
  if (c.meeting?.attended === true) {
    items.push({
      icon: <Video className="size-3" />,
      label: "Met",
      tone: "var(--stage-meeting)",
    });
  }
  if (c.meeting?.attended === false) {
    items.push({
      icon: <CircleSlash className="size-3" />,
      label: "No-show",
      tone: "var(--stage-lost)",
    });
  }
  if (c.onboarding?.completedAt) {
    items.push({
      icon: <FileCheck2 className="size-3" />,
      label: c.onboarding.form === "crm" ? "CRM" : "Payment",
      tone: "var(--stage-onboarding)",
    });
  }
  if (c.followUps.length > 0) {
    items.push({
      icon: <MessageCircle className="size-3" />,
      label: `${c.followUps.length} follow-up${c.followUps.length === 1 ? "" : "s"}`,
      tone: "var(--muted-foreground)",
    });
  }

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
          style={{
            backgroundColor: `color-mix(in oklch, ${it.tone} 12%, transparent)`,
            color: it.tone,
          }}
        >
          {it.icon}
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function CustomerCard({ c }: { c: Customer }) {
  const sourceMeta = SOURCE_META[c.attribution.source];
  return (
    <Link
      href={`/customers/${c.id}`}
      className="block rounded-xl border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:ring-1 hover:ring-ring/40"
    >
      <div className="flex items-start gap-2.5">
        <CustomerAvatar name={c.name} color={c.avatarColor} className="size-8" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">
            {c.name}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {c.company}
          </div>
        </div>
        {c.dealValue > 0 && (
          <span className="text-xs font-semibold text-muted-foreground">
            {formatCurrency(c.dealValue)}
          </span>
        )}
      </div>

      <div className="mt-2.5">
        <Signals c={c} />
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1">
        {c.services.slice(0, 3).map((s) => (
          <span
            key={s}
            className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
          >
            {SERVICE_META[s]}
          </span>
        ))}
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <DynamicIcon name={sourceMeta.icon} className="size-3" />
          {sourceMeta.label}
        </span>
        <span>{relativeTime(c.updatedAt)}</span>
      </div>
    </Link>
  );
}
