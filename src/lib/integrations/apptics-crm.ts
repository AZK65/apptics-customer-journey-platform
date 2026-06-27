import type { Customer, Stage } from "@/lib/types";
import { integrationConfig } from "./config";
import {
  normalizeSource,
  parseServices,
  avatarColorFor,
  type RawAttribution,
} from "./normalize";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — Apptics Sales CRM adapter (the journey spine).
//
// REST API at https://sales.apptics.org. Auth via `X-API-Key`. Reads leads and
// maps each one into our `Customer` shape — identity, attribution, baseline
// stage and follow-up date all come from here; later phases enrich each record
// with booking / group-chat / meeting / payment-onboarding events.
//
// See CRM_API_AND_WEBHOOKS.md for the contract.
// ─────────────────────────────────────────────────────────────────────────────

/** The CRM lead object, per the API docs. */
export interface CrmLead {
  id: number;
  name?: string | null;
  brand?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  username?: string | null; // e.g. telegram handle
  company_revenue?: string | null; // band, e.g. "$30k - $100k"
  stage?: string | null;
  status?: string | null; // "Open" | "Won" | "Lost"
  follow_up_date?: string | null; // YYYY-MM-DD
  notes?: string | null;
  won_at?: string | null;
  lost_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  custom?: Record<string, string> | null;
}

// Explicit mapping of the CRM's real pipeline stages → our journey stages.
// (The CRM keeps "Won" as the stage while status stays "Open", so we key off
// the stage text, not status, for Won detection.)
const STAGE_MAP: Record<string, Stage> = {
  "send message": "source",
  "looking to partner": "meeting",
  proposal: "meeting",
  "need to reschedule": "meeting",
  "needs to fill-in form": "onboarding",
  "app under review": "onboarding",
  "won (crm)": "won",
  "won (payments)": "won",
  "won (both)": "won",
  lost: "lost",
};

/** Map the CRM's status/stage to our pipeline floor stage. */
export function crmStageOf(lead: CrmLead): Stage | undefined {
  if ((lead.status ?? "").toLowerCase() === "lost" || lead.lost_at) return "lost";

  const stage = (lead.stage ?? "").trim().toLowerCase();
  if (STAGE_MAP[stage]) return STAGE_MAP[stage];

  // Fallbacks for any stages added to the CRM later.
  if (/\bwon\b|client/.test(stage)) return "won";
  if (/lost|dead|disqualif/.test(stage)) return "lost";
  if (/form|onboard|review|application/.test(stage)) return "onboarding";
  if (/proposal|negotiat|meeting|demo|call|reschedul|partner|present/.test(stage))
    return "meeting";
  if (/qualif|book|schedul/.test(stage)) return "booked";
  return "source";
}

/** Parse a revenue band like "$50K - $100K", ">$50k", "$1M+" into a number
 *  (midpoint of a range, or the single bound). Used as a value proxy since the
 *  CRM has no contract-amount field. Returns 0 for "N/A" / blank. */
export function parseRevenueBand(raw?: string | null): number {
  if (!raw) return 0;
  const s = raw.toLowerCase();
  if (s.includes("n/a")) return 0;
  const re = /([\d.]+)\s*([km])?/g;
  const nums: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null && nums.length < 2) {
    let n = parseFloat(m[1]);
    if (!isFinite(n)) continue;
    if (m[2] === "k") n *= 1_000;
    else if (m[2] === "m") n *= 1_000_000;
    nums.push(n);
  }
  if (nums.length === 0) return 0;
  if (nums.length === 1) return Math.round(nums[0]);
  return Math.round((nums[0] + nums[1]) / 2);
}

/** Attribution: the channel lives in a known custom column (Cal.com, Twitter,
 *  Facebook, Referral…). Read that column first; if it's blank, fall back to a
 *  safe scan of other custom values (excluding the email/phone duplicates). */
function attributionOf(lead: CrmLead): RawAttribution {
  const custom = lead.custom ?? {};
  const pinned = custom[integrationConfig.crm.sourceColumn];
  if (pinned) return { source: pinned, sourceDetail: pinned };

  const phoneShaped = (v: string) => /^\+?[\d\s().-]{7,}$/.test(v);
  const channel = Object.values(custom)
    .filter(
      (v) =>
        !!v &&
        v !== lead.email &&
        v !== lead.phone &&
        !v.includes("@") &&
        !phoneShaped(v),
    )
    .join(" ");
  return { source: channel || null, sourceDetail: channel || null };
}

function campaignOf(lead: CrmLead): string | undefined {
  const custom = lead.custom ?? {};
  const entry = Object.entries(custom).find(([k]) => /campaign|utm/i.test(k));
  return entry?.[1] || undefined;
}

/** Read the captured Facebook ad params from the configured custom columns. */
function adOf(lead: CrmLead): import("@/lib/types").AdAttribution | undefined {
  const custom = lead.custom ?? {};
  const { adNameColumn, adCampaignColumn, adIdColumn } = integrationConfig.crm;
  const adName = adNameColumn ? custom[adNameColumn] : undefined;
  const campaignName = adCampaignColumn ? custom[adCampaignColumn] : undefined;
  const adId = adIdColumn ? custom[adIdColumn] : undefined;
  if (!adName && !campaignName && !adId) return undefined;
  return {
    platform: "facebook",
    adId: adId || undefined,
    adName: adName || undefined,
    campaignName: campaignName || undefined,
  };
}

function companyOf(lead: CrmLead): string {
  if (lead.brand?.trim()) return lead.brand.trim();
  if (lead.website?.trim()) {
    try {
      return new URL(
        lead.website.startsWith("http") ? lead.website : `https://${lead.website}`,
      ).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
  }
  return "—";
}

/** Map one CRM lead into our Customer shape. */
export function mapLeadToCustomer(lead: CrmLead): Customer {
  const createdAt = lead.created_at ?? new Date(0).toISOString();
  const email = lead.email ?? "";
  const key = String(lead.id) || email || lead.name || "lead";

  return {
    id: `crm_${lead.id}`,
    name: lead.name?.trim() || lead.brand?.trim() || "Unknown lead",
    company: companyOf(lead),
    email,
    phone: lead.phone ?? undefined,
    telegram: lead.username ?? undefined,
    avatarColor: avatarColorFor(key),
    owner: "Apptics Sales",
    // No contract-amount field in this CRM — use the merchant's revenue band as a
    // value proxy so the value-based widgets are meaningful.
    dealValue: parseRevenueBand(lead.company_revenue),
    services: parseServices(lead.notes),
    attribution: {
      source: normalizeSource(attributionOf(lead)),
      campaign: campaignOf(lead),
      ad: adOf(lead),
      detail:
        lead.company_revenue?.trim() ||
        lead.notes?.trim() ||
        undefined,
      capturedAt: createdAt,
      capturedBy: "Apptics Sales CRM",
    },
    followUps: [],
    crmStage: crmStageOf(lead),
    createdAt,
    updatedAt: lead.updated_at ?? createdAt,
  };
}

async function crmFetch(path: string): Promise<Response> {
  const { apiUrl, apiKey } = integrationConfig.crm;
  return fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}

/**
 * Fetch all leads from the CRM (paging through `limit`/`offset`) and map them
 * to Customers. Returns [] on any failure so the aggregator falls back to mock.
 */
export async function fetchCrmCustomers(): Promise<Customer[]> {
  const { apiKey, leadLimit } = integrationConfig.crm;
  if (!apiKey) return [];

  try {
    const pageSize = Math.min(leadLimit, 1000);
    const all: CrmLead[] = [];
    let offset = 0;

    // Page until we've gathered leadLimit or the CRM runs out.
    while (all.length < leadLimit) {
      const res = await crmFetch(`/api/v1/leads?limit=${pageSize}&offset=${offset}`);
      if (!res.ok) {
        console.error(`[crm] HTTP ${res.status} listing leads`);
        break;
      }
      const json = (await res.json()) as { leads?: CrmLead[] };
      const batch = json.leads ?? [];
      all.push(...batch);
      if (batch.length < pageSize) break; // last page
      offset += pageSize;
    }

    return all.slice(0, leadLimit).map(mapLeadToCustomer);
  } catch (err) {
    console.error("[crm] fetch failed:", (err as Error).message);
    return [];
  }
}

/** Fetch a single lead by its CRM id (numeric portion of `crm_<id>`). */
export async function fetchCrmLead(crmId: string | number): Promise<Customer | undefined> {
  if (!integrationConfig.crm.apiKey) return undefined;
  const id = String(crmId).replace(/^crm_/, "");
  try {
    const res = await crmFetch(`/api/v1/leads/${id}`);
    if (!res.ok) return undefined;
    const lead = (await res.json()) as CrmLead;
    return mapLeadToCustomer(lead);
  } catch {
    return undefined;
  }
}
