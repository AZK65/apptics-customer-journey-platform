import type {
  Customer,
  LeadSource,
  ServiceKind,
  Stage,
  ChatPlatform,
  TimelineEvent,
} from "./types";

// ── Display metadata ─────────────────────────────────────────────────────────

export const STAGE_ORDER: Stage[] = [
  "source",
  "booked",
  "groupchat",
  "meeting",
  "onboarding",
  "won",
];

export const STAGE_META: Record<
  Stage,
  { label: string; color: string; description: string }
> = {
  source: {
    label: "New Lead",
    color: "var(--stage-source)",
    description: "Captured & attributed",
  },
  booked: {
    label: "Call Booked",
    color: "var(--stage-booked)",
    description: "Booked on Cal.com",
  },
  groupchat: {
    label: "Group Chat",
    color: "var(--stage-groupchat)",
    description: "Chat spun up by bot",
  },
  meeting: {
    label: "Met",
    color: "var(--stage-meeting)",
    description: "Attended the call",
  },
  onboarding: {
    label: "Onboarding",
    color: "var(--stage-onboarding)",
    description: "Filling forms",
  },
  won: {
    label: "Won",
    color: "var(--stage-won)",
    description: "Onboarded & paying",
  },
  lost: {
    label: "Lost",
    color: "var(--stage-lost)",
    description: "Dropped out",
  },
};

export const SOURCE_META: Record<LeadSource, { label: string; icon: string }> = {
  linkedin: { label: "LinkedIn", icon: "Linkedin" },
  cold_email: { label: "Cold Email", icon: "Mail" },
  referral: { label: "Referral", icon: "Users" },
  website_form: { label: "Website Form", icon: "Globe" },
  paid_ad: { label: "Paid Ad", icon: "Megaphone" },
  twitter_dm: { label: "X / Twitter DM", icon: "Twitter" },
  youtube: { label: "YouTube", icon: "Youtube" },
  inbound_call: { label: "Inbound Call", icon: "PhoneCall" },
};

export const SERVICE_META: Record<ServiceKind, string> = {
  crm_setup: "CRM Setup",
  payment_processor: "Payment Processor",
  bot_automation: "Bot Automation",
  lead_generation: "Lead Generation",
  ai_agents: "AI Agents",
  web_app: "Web App",
};

export const PLATFORM_META: Record<ChatPlatform, { label: string; icon: string }> = {
  whatsapp: { label: "WhatsApp", icon: "MessageCircle" },
  telegram: { label: "Telegram", icon: "Send" },
  slack: { label: "Slack", icon: "Slack" },
  discord: { label: "Discord", icon: "MessageSquare" },
};

// ── Stage derivation ─────────────────────────────────────────────────────────
// The stage is computed from the data, never stored — so it always reflects the
// latest integration writes.

export function deriveStage(c: Customer): Stage {
  // A completed full CRM onboarding implies they're set up (won). A completed
  // payment form is just the onboarding step — the CRM stage decides Won.
  if (c.onboarding?.completedAt && c.onboarding.crmRecordId) return "won";
  if (c.onboarding?.completedAt) return "onboarding";
  if (c.onboarding?.form) return "onboarding"; // form sent / in progress
  if (c.meeting?.attended === true) return "meeting";
  if (c.meeting?.attended === false || c.meeting?.noShow) {
    // No-show: they're still in the group-chat / follow-up loop, not lost yet.
    return "groupchat";
  }
  if (c.groupChat) return "groupchat";
  if (c.booking) return "booked";
  return "source";
}

export function isLost(c: Customer): boolean {
  // No-show with 3+ unanswered follow-ups and stale => lost
  if (c.meeting?.attended === false) {
    const unanswered = c.followUps.filter((f) => !f.responded).length;
    return unanswered >= 3 && c.followUps.length > 0 && !c.onboarding?.completedAt;
  }
  return false;
}

export function effectiveStage(c: Customer): Stage {
  if (isLost(c)) return "lost";
  const derived = deriveStage(c);
  // The CRM stage acts as a floor: if it places the customer further along than
  // the operational signals we have so far, trust it. (Terminal CRM stages win.)
  if (c.crmStage) {
    if (c.crmStage === "lost") return "lost";
    if (c.crmStage === "won") return "won";
    const derivedIdx = STAGE_ORDER.indexOf(derived);
    const crmIdx = STAGE_ORDER.indexOf(c.crmStage);
    if (crmIdx > derivedIdx) return c.crmStage;
  }
  return derived;
}

// ── Funnel metrics ───────────────────────────────────────────────────────────

export interface FunnelStep {
  stage: Stage;
  label: string;
  count: number;
  color: string;
}

/** Has this customer reached *at least* the given stage? (Lost = reached nothing further.) */
export function hasReached(c: Customer, stage: Stage): boolean {
  const s = effectiveStage(c);
  if (s === "lost") return false;
  return STAGE_ORDER.indexOf(s) >= STAGE_ORDER.indexOf(stage);
}

/** Customers whose journey currently rests at exactly this stage. */
export function atStage(customers: Customer[], stage: Stage): Customer[] {
  return customers.filter((c) => effectiveStage(c) === stage);
}

/**
 * Cumulative funnel. Stage 0 (New Lead) counts everyone — every customer was a
 * lead — so conversion reads against the full lead count. Later stages count
 * whoever reached at least that far (lost leads only count at New Lead).
 */
export function computeFunnel(customers: Customer[]): FunnelStep[] {
  return STAGE_ORDER.map((stage, i) => ({
    stage,
    label: STAGE_META[stage].label,
    color: STAGE_META[stage].color,
    count: customers.filter((c) => (i === 0 ? true : hasReached(c, stage))).length,
  }));
}

export function conversionRate(funnel: FunnelStep[]): number {
  if (!funnel.length || funnel[0].count === 0) return 0;
  const won = funnel[funnel.length - 1].count;
  return won / funnel[0].count;
}

// ── Time series (for the analytics area chart) ───────────────────────────────

export interface SeriesPoint {
  date: string; // YYYY-MM-DD
  leads: number;
  won: number;
}

const dayKey = (d: string | number | Date) =>
  new Date(d).toISOString().slice(0, 10);

/** Daily New-Leads vs Won over the last `days`, ending at the latest data point. */
export function buildLeadSeries(customers: Customer[], days = 30): SeriesPoint[] {
  if (customers.length === 0) return [];
  const maxTs = Math.max(...customers.map((c) => +new Date(c.createdAt)));
  const endDay = Date.parse(dayKey(maxTs));
  const start = endDay - (days - 1) * 86_400_000;

  const buckets = new Map<string, SeriesPoint>();
  for (let i = 0; i < days; i++) {
    const k = dayKey(start + i * 86_400_000);
    buckets.set(k, { date: k, leads: 0, won: 0 });
  }
  for (const c of customers) {
    const lk = dayKey(c.createdAt);
    if (buckets.has(lk)) buckets.get(lk)!.leads += 1;
    if (effectiveStage(c) === "won") {
      const wk = dayKey(c.onboarding?.completedAt ?? c.updatedAt);
      if (buckets.has(wk)) buckets.get(wk)!.won += 1;
    }
  }
  return [...buckets.values()];
}

export function formatDayShort(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(iso + "T00:00:00"),
  );
}

// ── Timeline builder ─────────────────────────────────────────────────────────

export function buildTimeline(c: Customer): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    id: `${c.id}-source`,
    at: c.attribution.capturedAt,
    kind: "source",
    title: `Lead captured — ${SOURCE_META[c.attribution.source].label}`,
    description: c.attribution.detail,
    actor: c.attribution.capturedBy ?? "System",
  });

  if (c.booking) {
    events.push({
      id: `${c.id}-booking`,
      at: c.booking.bookedAt,
      kind: "booking",
      title: `Booked "${c.booking.eventType}" on Cal.com`,
      description: `Scheduled for ${formatDateTime(c.booking.scheduledFor)} · ${c.booking.status}`,
      actor: "Cal.com",
    });
  }

  if (c.groupChat) {
    events.push({
      id: `${c.id}-groupchat`,
      at: c.groupChat.createdAt,
      kind: "groupchat",
      title: `${PLATFORM_META[c.groupChat.platform].label} group chat created`,
      description: `${c.groupChat.createdByBot ? `By ${c.groupChat.botName}` : "Created manually"} · ${c.groupChat.memberCount} members`,
      actor: c.groupChat.createdByBot ? c.groupChat.botName : "Sales rep",
    });
  }

  if (c.meeting) {
    if (c.meeting.attended === true) {
      events.push({
        id: `${c.id}-meeting`,
        at: c.meeting.scheduledFor,
        kind: "meeting",
        title: "Attended the meeting",
        description: c.meeting.notes ?? `${c.meeting.durationMin ?? 30} min call`,
        actor: c.owner,
      });
    } else if (c.meeting.attended === false || c.meeting.noShow) {
      events.push({
        id: `${c.id}-noshow`,
        at: c.meeting.scheduledFor,
        kind: "noshow",
        title: "No-show on the meeting",
        description: "Did not join the scheduled call",
        actor: "System",
      });
    }
  }

  for (const f of c.followUps) {
    events.push({
      id: `${c.id}-fu-${f.at}`,
      at: f.at,
      kind: f.by === "bot" ? "followup_bot" : "followup_human",
      title: `${f.by === "bot" ? "Bot" : "Manual"} follow-up via ${f.channel}`,
      description: `${f.message}${f.responded ? " · ✅ replied" : " · ⏳ no reply"}`,
      actor: f.actorName,
    });
  }

  if (c.onboarding?.completedAt) {
    events.push({
      id: `${c.id}-onboarding`,
      at: c.onboarding.completedAt,
      kind: "onboarding",
      title: `Completed ${c.onboarding.form === "crm" ? "CRM onboarding" : "Payment"} form`,
      description:
        c.onboarding.form === "crm"
          ? `CRM record ${c.onboarding.crmRecordId ?? "created"}`
          : `Payment customer ${c.onboarding.paymentCustomerId ?? "created"}`,
      actor: c.name,
    });
  }

  if (effectiveStage(c) === "won") {
    events.push({
      id: `${c.id}-won`,
      at: c.onboarding?.completedAt ?? c.updatedAt,
      kind: "won",
      title: "Customer won 🎉",
      description: `Deal value ${formatCurrency(c.dealValue)}`,
      actor: c.owner,
    });
  }

  return events.sort((a, b) => +new Date(a.at) - +new Date(b.at));
}

// ── Formatting helpers ───────────────────────────────────────────────────────

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function relativeTime(iso: string, now = new Date("2026-06-23T18:00:00Z")): string {
  const diff = +now - +new Date(iso);
  const mins = Math.round(diff / 60000);
  const hrs = Math.round(mins / 60);
  const days = Math.round(hrs / 24);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

// ── Geography (derive country from the phone's calling code) ─────────────────

// [callingCode, country, flag] — longest codes first so prefixes match greedily.
const CALLING_CODES: [string, string, string][] = [
  ["971", "UAE", "🇦🇪"], ["972", "Israel", "🇮🇱"], ["353", "Ireland", "🇮🇪"],
  ["351", "Portugal", "🇵🇹"], ["380", "Ukraine", "🇺🇦"], ["234", "Nigeria", "🇳🇬"],
  ["254", "Kenya", "🇰🇪"], ["212", "Morocco", "🇲🇦"], ["852", "Hong Kong", "🇭🇰"],
  ["44", "United Kingdom", "🇬🇧"], ["91", "India", "🇮🇳"], ["61", "Australia", "🇦🇺"],
  ["49", "Germany", "🇩🇪"], ["33", "France", "🇫🇷"], ["34", "Spain", "🇪🇸"],
  ["39", "Italy", "🇮🇹"], ["31", "Netherlands", "🇳🇱"], ["46", "Sweden", "🇸🇪"],
  ["41", "Switzerland", "🇨🇭"], ["48", "Poland", "🇵🇱"], ["55", "Brazil", "🇧🇷"],
  ["52", "Mexico", "🇲🇽"], ["63", "Philippines", "🇵🇭"], ["92", "Pakistan", "🇵🇰"],
  ["65", "Singapore", "🇸🇬"], ["64", "New Zealand", "🇳🇿"], ["90", "Turkey", "🇹🇷"],
  ["27", "South Africa", "🇿🇦"], ["66", "Thailand", "🇹🇭"], ["62", "Indonesia", "🇮🇩"],
  ["60", "Malaysia", "🇲🇾"], ["84", "Vietnam", "🇻🇳"], ["82", "South Korea", "🇰🇷"],
  ["81", "Japan", "🇯🇵"], ["86", "China", "🇨🇳"], ["20", "Egypt", "🇪🇬"],
  ["7", "Russia", "🇷🇺"], ["1", "United States", "🇺🇸"],
];

export interface Country {
  name: string;
  flag: string;
}

/** Best-effort country from a phone number's calling code. */
export function countryFromPhone(phone?: string): Country | null {
  if (!phone) return null;
  const intl = phone.trim().startsWith("+") || phone.trim().startsWith("00");
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // Bare 10-digit (or 11-digit leading 1) numbers with no "+" are US/Canada.
  if (!intl && (digits.length === 10 || (digits.length === 11 && digits[0] === "1")))
    return { name: "United States", flag: "🇺🇸" };
  const d = phone.trim().startsWith("00") ? digits.slice(2) : digits;
  for (const [code, name, flag] of CALLING_CODES) {
    if (d.startsWith(code)) return { name, flag };
  }
  return { name: "Other", flag: "🌐" };
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
