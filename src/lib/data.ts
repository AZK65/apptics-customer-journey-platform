import type { Customer } from "./types";
import { MOCK_CUSTOMERS } from "./mock-data";
import { anyLiveSource } from "./integrations/config";
import { aggregateCustomers } from "./integrations/aggregate";

// ─────────────────────────────────────────────────────────────────────────────
// Data provider seam.
//
// If any real source is configured (see src/lib/integrations/config.ts + env
// vars), we aggregate live data from the Apptics stack — the CRM, the
// whatsapp-service, and apptics-pay — into the shared `Customer` shape.
// Otherwise we serve mock data, so the app always runs.
//
//   getCustomers()  ─┐
//                    ├─ CRM (leads / pipeline)                   [Phase 1]
//                    ├─ whatsapp-service (booking + group chat)  [Phase 2]
//                    └─ apptics-pay (payment onboarding)         [Phase 3]
// ─────────────────────────────────────────────────────────────────────────────

export async function getCustomers(): Promise<Customer[]> {
  if (anyLiveSource()) {
    try {
      const live = await aggregateCustomers();
      if (live.length > 0) return live;
      console.warn("[data] live sources returned no customers — using mock data");
    } catch (err) {
      console.error("[data] live aggregation failed — using mock data:", err);
    }
  }
  return MOCK_CUSTOMERS;
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  // Go through the full aggregation so the detail view includes every source's
  // enrichment (payment onboarding, group conversation, …), not just the CRM.
  const all = await getCustomers();
  return all.find((c) => c.id === id);
}

/** Whether the app is currently serving live data (used by the Integrations page). */
export function isLive(): boolean {
  return anyLiveSource();
}
