import nodeFs from "node:fs";
import nodePath from "node:path";
import type { AdAttribution } from "@/lib/types";
import { joinKey, phoneKey } from "./normalize";

// ─────────────────────────────────────────────────────────────────────────────
// Booking-capture store.
//
// The Cal.com webhook (/api/cal-hook) writes what it learned at booking time —
// the Facebook ad (UTMs) and the device — keyed by the booker's email & phone.
// The aggregator reads it and attaches the ad + device to the matching CRM lead,
// without writing anything back to the CRM.
// ─────────────────────────────────────────────────────────────────────────────

export interface CaptureEntry {
  ad?: AdAttribution;
  device?: string;
  at: string; // ISO — when captured
  via: string; // e.g. "cal.com"
}

export type CaptureStore = Record<string, CaptureEntry>;

function storePath(): string {
  return (
    process.env.AD_STORE_PATH?.trim() ||
    nodePath.join(process.cwd(), "data", "ad-attribution.json")
  );
}

export function readAdStore(): CaptureStore {
  try {
    return JSON.parse(nodeFs.readFileSync(storePath(), "utf8")) as CaptureStore;
  } catch {
    return {};
  }
}

function writeAdStore(store: CaptureStore): void {
  const file = storePath();
  nodeFs.mkdirSync(nodePath.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  nodeFs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  nodeFs.renameSync(tmp, file);
}

/** Record what we learned about a booking (ad and/or device) against email/phone. */
export function upsertAdEntry(opts: {
  email?: string | null;
  phone?: string | null;
  ad?: AdAttribution;
  device?: string;
  via?: string;
}): { keys: string[] } {
  if (!opts.ad && !opts.device) return { keys: [] };
  const store = readAdStore();
  const entry: CaptureEntry = {
    ad: opts.ad,
    device: opts.device,
    at: new Date().toISOString(),
    via: opts.via || "cal.com",
  };
  const keys: string[] = [];
  if (opts.email) {
    const k = `e:${joinKey(opts.email)}`;
    store[k] = entry;
    keys.push(k);
  }
  if (opts.phone) {
    const pk = phoneKey(opts.phone);
    if (pk.length >= 7) {
      const k = `p:${pk}`;
      store[k] = entry;
      keys.push(k);
    }
  }
  if (keys.length) writeAdStore(store);
  return { keys };
}

/** Look up a captured booking by a lead's email or phone. */
export function lookupAd(
  store: CaptureStore,
  email?: string,
  phone?: string,
): CaptureEntry | undefined {
  if (email) {
    const hit = store[`e:${joinKey(email)}`];
    if (hit) return hit;
  }
  if (phone) {
    const pk = phoneKey(phone);
    if (pk.length >= 7) {
      const hit = store[`p:${pk}`];
      if (hit) return hit;
    }
  }
  return undefined;
}

export function adStoreCount(): number {
  return Object.keys(readAdStore()).length;
}
