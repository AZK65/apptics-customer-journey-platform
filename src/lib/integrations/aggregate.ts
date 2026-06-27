import type { Customer } from "@/lib/types";
import { integrationConfig } from "./config";
import { fetchCrmCustomers } from "./apptics-crm";
import { enrichWithWhatsApp } from "./whatsapp";
import { enrichWithTelegram } from "./telegram";
import { enrichWithApticsPay } from "./apptics-pay";
import { fetchAdSpend } from "./meta";
import { readAdStore, lookupAd } from "./ad-store";
import { joinKey, phoneKey } from "./normalize";

// ─────────────────────────────────────────────────────────────────────────────
// Aggregator — merges every live source into one `Customer[]`.
//
//   CRM ──────► base customers (identity, attribution, deal, crmStage)
//        │
//        ├─ whatsapp-service  ──► booking, groupChat, follow-ups   (Phase 2)
//        └─ apptics-pay       ──► onboarding (payment)             (Phase 3)
//
// Enrichment phases match against the base list by email/phone (joinKey) and
// patch the relevant sub-object. They're no-ops until their env vars are set.
// ─────────────────────────────────────────────────────────────────────────────

/** An index for matching enrichment records back to base customers. */
export interface CustomerIndex {
  byEmail: Map<string, Customer>;
  byPhone: Map<string, Customer>;
  byHandle: Map<string, Customer>;
}

function buildIndex(customers: Customer[]): CustomerIndex {
  const byEmail = new Map<string, Customer>();
  const byPhone = new Map<string, Customer>();
  const byHandle = new Map<string, Customer>();
  for (const c of customers) {
    if (c.email) byEmail.set(joinKey(c.email), c);
    if (c.phone) {
      const pk = phoneKey(c.phone);
      if (pk.length >= 7) byPhone.set(pk, c);
    }
    if (c.telegram) byHandle.set(joinKey(c.telegram), c);
  }
  return { byEmail, byPhone, byHandle };
}

export async function aggregateCustomers(): Promise<Customer[]> {
  // ── Base: the CRM spine ──────────────────────────────────────────────────
  let base: Customer[] = [];
  if (integrationConfig.crm.enabled) {
    base = await fetchCrmCustomers();
  }

  if (base.length === 0) return [];

  const index = buildIndex(base);

  // ── Phase 2: WhatsApp groups (booking + group chat + follow-ups) ─────────
  if (integrationConfig.whatsapp.enabled) {
    await enrichWithWhatsApp(index);
  }

  // ── Phase 2b: Telegram groups (attached where no WhatsApp group matched) ─
  if (integrationConfig.telegram.enabled) {
    await enrichWithTelegram(index);
  }

  // ── Phase 3: apptics-pay (payment onboarding) ────────────────────────────
  if (integrationConfig.apticsPay.enabled) {
    await enrichWithApticsPay(index);
  }

  // ── Facebook ads: attach the ad captured at booking time (Cal.com webhook) ─
  const adStore = readAdStore();
  if (Object.keys(adStore).length) {
    for (const c of base) {
      const hit = lookupAd(adStore, c.email, c.phone);
      if (!hit) continue;
      if (!c.attribution.ad && hit.ad) c.attribution.ad = { ...hit.ad };
      if (hit.device && !c.device) c.device = hit.device;
    }
  }

  // ── Facebook ads: enrich the captured ad with canonical names + spend ─────
  // Only call Meta when there are ad-attributed leads to enrich (the /ads page
  // fetches the full ad list separately). Avoids hammering the API every load.
  if (integrationConfig.meta.enabled && base.some((c) => c.attribution.ad)) {
    const ads = await fetchAdSpend();
    for (const c of base) {
      const ad = c.attribution.ad;
      if (!ad) continue;
      const hit =
        (ad.adId && ads.byId.get(ad.adId)) ||
        (ad.adName && ads.byName.get(ad.adName.trim().toLowerCase()));
      if (hit) {
        ad.adName ||= hit.adName;
        ad.adsetName ||= hit.adsetName;
        ad.campaignName ||= hit.campaignName;
        ad.spend = hit.spend;
      }
    }
  }

  return base.sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
  );
}
