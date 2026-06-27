import type { LeadSource, ServiceKind, Stage } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Field normalizers that translate raw CRM/affiliate values into the platform's
// typed enums. The attribution cascade mirrors apptics-analytics/lib/queries.ts
// ("most-precise-signal-wins").
// ─────────────────────────────────────────────────────────────────────────────

export interface RawAttribution {
  source?: string | null;
  sourceDetail?: string | null;
  leadSource?: string | null;
  bookingEvent?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  utmSource?: string | null;
}

/** Map any raw CRM source signal to one of our LeadSource enum values. */
export function normalizeSource(raw: RawAttribution): LeadSource {
  const s = (raw.source ?? "").toLowerCase();
  const legacy = (raw.leadSource ?? "").toLowerCase();
  const booking = (raw.bookingEvent ?? "").toLowerCase();
  const detail = (raw.sourceDetail ?? "").toLowerCase();
  const blob = `${s} ${legacy} ${detail}`;

  // 1. Measured paid clicks win.
  if (raw.gclid || raw.fbclid) return "paid_ad";
  if (/paid|google|meta|facebook|ads?/.test(blob)) return "paid_ad";

  // 2. Affiliate / referral / partner.
  if (/partner|referr|affiliate/.test(blob) || /affiliate/.test(booking))
    return "referral";

  // 3. Named channels.
  if (/linkedin/.test(blob)) return "linkedin";
  if (/(twitter|x\.com|\bx\b)/.test(blob)) return "twitter_dm";
  if (/youtube|yt\b/.test(blob)) return "youtube";
  if (/email|cold|outbound|sequence/.test(blob)) return "cold_email";
  if (/call|inbound|phone/.test(blob)) return "inbound_call";
  if (/social/.test(blob)) return "twitter_dm";

  // 4. Website / organic / direct booking.
  if (/website|web|form|organic|seo|direct/.test(blob)) return "website_form";
  if (/cal\.?com|booking|intro/.test(`${s} ${booking}`)) return "website_form";

  return "website_form";
}

/** Twenty `lead.stage` (NEW…WON/LOST/STALE) → our pipeline floor stage. */
export function normalizeStage(raw?: string | null): Stage | undefined {
  switch ((raw ?? "").toUpperCase()) {
    case "WON":
      return "won";
    case "LOST":
      return "lost";
    case "PROPOSAL":
    case "NEGOTIATION":
      return "meeting";
    case "QUALIFIED":
      return "booked";
    case "NEW":
    case "CONTACTED":
    case "STALE":
      return "source";
    default:
      return undefined;
  }
}

const SERVICE_KEYWORDS: [RegExp, ServiceKind][] = [
  [/crm|pipeline|hubspot|salesforce/i, "crm_setup"],
  [/pay|payment|stripe|processor|merchant|checkout|billing/i, "payment_processor"],
  [/bot|automation|automate|workflow|whatsapp|telegram/i, "bot_automation"],
  [/lead|prospect|outbound|cold|scrap/i, "lead_generation"],
  [/ai|agent|gpt|llm|assistant/i, "ai_agents"],
  [/app|web|site|portal|dashboard|landing/i, "web_app"],
];

/** Best-effort parse of a free-text "needs" field into service tags. */
export function parseServices(needs?: string | null): ServiceKind[] {
  if (!needs) return [];
  const found = new Set<ServiceKind>();
  for (const [re, kind] of SERVICE_KEYWORDS) {
    if (re.test(needs)) found.add(kind);
  }
  return [...found];
}

const PALETTE = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#0ea5e9", "#f97316", "#14b8a6", "#a855f7", "#84cc16", "#06b6d4",
  "#d946ef", "#eab308",
];

/** Deterministic avatar color from a stable key (id or email). */
export function avatarColorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

/** Normalize an email to a join key for cross-source merging. */
export function joinKey(value?: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9@.+]/g, "");
}

/** Phone match key: digits only, last 10 (so "+1 770-500-7113" === "770-500-7113"). */
export function phoneKey(value?: string | null): string {
  const d = (value ?? "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}
