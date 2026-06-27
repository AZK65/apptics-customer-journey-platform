// ─────────────────────────────────────────────────────────────────────────────
// Customer Journey domain model for Apptics
//
// Each customer record is the single source of truth. Every integration
// (Cal.com, group-chat bots, CRM, payment processor, follow-up bots) writes
// into one of the typed sub-objects below. The UI derives the funnel stage,
// the timeline, and all metrics from this shape — so wiring real data later
// means replacing the mock provider, not touching the components.
// ─────────────────────────────────────────────────────────────────────────────

export type LeadSource =
  | "linkedin"
  | "cold_email"
  | "referral"
  | "website_form"
  | "paid_ad"
  | "twitter_dm"
  | "youtube"
  | "inbound_call";

export type ServiceKind =
  | "crm_setup"
  | "payment_processor"
  | "bot_automation"
  | "lead_generation"
  | "ai_agents"
  | "web_app";

export type ChatPlatform = "whatsapp" | "telegram" | "slack" | "discord";

export type OnboardingFormKind = "crm" | "payment" | null;

export type FollowUpActor = "bot" | "human";

// The canonical funnel stages, in order.
export type Stage =
  | "source" // captured a lead, know where it came from
  | "booked" // booked a call on Cal.com
  | "groupchat" // a group chat was spun up
  | "meeting" // meeting attended
  | "onboarding" // filled an onboarding form (CRM or payment)
  | "won" // fully onboarded / paying
  | "lost"; // dropped out

/** Ad-level attribution — which specific paid ad drove the lead. */
export interface AdAttribution {
  platform: "facebook";
  adId?: string; // e.g. fb_ad_id={{ad.id}}
  adName?: string; // utm_content={{ad.name}}
  adsetName?: string;
  campaignName?: string; // utm_campaign={{campaign.name}}
  /** Ad-level spend over the window (from the Meta Marketing API, if connected). */
  spend?: number;
}

export interface Attribution {
  source: LeadSource;
  campaign?: string;
  /** Free-text detail, e.g. "Replied to Q2 SaaS founders sequence" */
  detail?: string;
  /** The specific paid ad this lead came from, when known. */
  ad?: AdAttribution;
  capturedAt: string; // ISO
  /** Which bot/automation captured it, if any */
  capturedBy?: string;
}

export interface Booking {
  provider: "cal.com";
  eventType: string; // e.g. "30 Min Discovery Call"
  bookedAt: string; // ISO — when the booking was made
  scheduledFor: string; // ISO — when the call is
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  /** Cal.com booking uid, for deep-linking once live */
  ref?: string;
}

export interface GroupMessage {
  id: string;
  at: string; // ISO
  fromMe: boolean; // sent by the Apptics number (our side: bot or rep)
  author?: string;
  body: string;
}

export interface GroupChat {
  platform: ChatPlatform;
  createdByBot: boolean;
  botName?: string; // e.g. "Apptics Onboarder Bot"
  createdAt: string; // ISO
  memberCount: number;
  /** Last message timestamp in the chat */
  lastActivityAt?: string;
  /** Full conversation read from the group (via the sales bot's live session) */
  messages?: GroupMessage[];
  ref?: string;
}

export interface Meeting {
  scheduledFor: string; // ISO
  attended: boolean | null; // null = hasn't happened yet
  durationMin?: number;
  noShow?: boolean;
  recordingUrl?: string;
  notes?: string;
}

export interface Onboarding {
  form: OnboardingFormKind; // which form they filled
  completedAt?: string; // ISO
  /** Captured form fields, kept generic so any form schema fits */
  fields?: Record<string, string>;
  crmRecordId?: string;
  paymentCustomerId?: string;
}

export interface FollowUp {
  by: FollowUpActor;
  actorName: string; // bot name or rep name
  channel: ChatPlatform | "email" | "call";
  at: string; // ISO
  message: string;
  responded: boolean;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string; // used to match cross-source records (e.g. WhatsApp bookings)
  telegram?: string; // telegram handle, another cross-source match key
  device?: string; // device used at booking (Desktop/Mobile/Tablet), captured via Cal.com
  avatarColor: string; // for the generated avatar
  owner: string; // sales rep
  dealValue: number; // USD
  services: ServiceKind[];
  attribution: Attribution;
  booking?: Booking;
  groupChat?: GroupChat;
  meeting?: Meeting;
  onboarding?: Onboarding;
  followUps: FollowUp[];
  /**
   * Baseline stage straight from the CRM (Twenty `lead.stage`). Used as a floor
   * when the operational signals (booking, group chat, meeting, onboarding) aren't
   * available yet — later integration phases refine the stage with real events.
   */
  crmStage?: Stage;
  createdAt: string; // ISO — first touch
  updatedAt: string; // ISO — last touch
}

// A flattened, sortable event for the per-customer timeline view.
export interface TimelineEvent {
  id: string;
  at: string; // ISO
  kind:
    | "source"
    | "booking"
    | "groupchat"
    | "meeting"
    | "noshow"
    | "onboarding"
    | "followup_bot"
    | "followup_human"
    | "won";
  title: string;
  description?: string;
  /** "bot" | "human" | "system" — who/what generated the event */
  actor?: string;
}
