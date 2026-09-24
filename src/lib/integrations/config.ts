// ─────────────────────────────────────────────────────────────────────────────
// Integration configuration.
//
// Each real Apptics source is wired in here and gated by env vars. When the env
// vars for a source are present, that source goes "live"; otherwise it stays off
// and `data.ts` falls back to mock data. This lets us flip sources on one at a
// time without touching any UI.
//
// Phase 1 — CRM (the spine)                   ← adapter pending CRM choice
// Phase 2 — whatsapp-service _bookings.json   ← scaffolded
// Phase 3 — apptics-pay payment onboarding    ← scaffolded
// ─────────────────────────────────────────────────────────────────────────────

import nodeFs from "node:fs";
import nodePath from "node:path";

const env = (k: string) => process.env[k]?.trim() || "";

export interface WhatsAppStore {
  status: string; // "connected" | "qr" | "disconnected" | …
  qr: string | null;
  me: string | null;
  updatedAt: string | null;
  groups: {
    id: string;
    name: string;
    participants: string[];
    messages: { id: string; at: string; fromMe: boolean; author?: string; body: string }[];
  }[];
}

export const integrationConfig = {
  // ── Phase 1: Apptics Sales CRM (REST) ──────────────────────────────────────
  // NB: all values are GETTERS so env is read fresh at access time (avoids stale
  // captures across dev HMR/restarts).
  crm: {
    // Base URL of the Apptics Sales CRM (default to the hosted instance).
    get apiUrl() {
      return env("CRM_API_URL") || "https://sales.apptics.org";
    },
    // X-API-Key for read/write access to leads.
    get apiKey() {
      return env("CRM_API_KEY");
    },
    // Shared secret for verifying inbound webhook signatures (optional).
    get webhookSecret() {
      return env("CRM_WEBHOOK_SECRET");
    },
    get leadLimit() {
      return Number(env("CRM_LEAD_LIMIT") || 200);
    },
    // Custom column key that holds the lead's channel/source (Cal.com, Twitter…).
    get sourceColumn() {
      return env("CRM_SOURCE_COLUMN") || "col_tla0q9mk1ikm";
    },
    // Custom columns where the captured Facebook ad params land (utm_content →
    // ad name, utm_campaign → campaign, fb_ad_id → ad id). Set the ones you use.
    get adNameColumn() {
      return env("CRM_AD_NAME_COLUMN");
    },
    get adCampaignColumn() {
      return env("CRM_AD_CAMPAIGN_COLUMN");
    },
    get adIdColumn() {
      return env("CRM_AD_ID_COLUMN");
    },
    // Only the API key gates "live" — the URL has a sensible default.
    get enabled() {
      return !!this.apiKey;
    },
  },

  // ── Phase 2: WhatsApp groups (QR-linked worker → store.json, no API) ────────
  whatsapp: {
    get dataPath() {
      return (
        env("WHATSAPP_DATA_PATH") ||
        nodePath.join(process.cwd(), "whatsapp-worker", "store.json")
      );
    },
    // Parsed worker store, or null if the worker hasn't run/connected.
    get store(): WhatsAppStore | null {
      try {
        return JSON.parse(nodeFs.readFileSync(this.dataPath, "utf8"));
      } catch {
        return null;
      }
    },
    // Live once the worker is linked and has synced at least one group.
    get enabled() {
      const s = this.store;
      return !!(s && s.status === "connected" && Array.isArray(s.groups));
    },
  },

  // ── Phase 2b: Telegram groups (reuses the saved gram.js session, no QR) ─────
  telegram: {
    get dataPath() {
      return (
        env("TELEGRAM_DATA_PATH") ||
        nodePath.join(process.cwd(), "telegram-worker", "store.json")
      );
    },
    get store(): WhatsAppStore | null {
      try {
        return JSON.parse(nodeFs.readFileSync(this.dataPath, "utf8"));
      } catch {
        return null;
      }
    },
    get enabled() {
      const s = this.store;
      return !!(s && s.status === "connected" && Array.isArray(s.groups));
    },
  },

  // ── Facebook ad tracking — Meta Marketing API (optional, for spend/CPL) ─────
  // Per-lead "which ad" works from captured UTMs alone; these creds only add
  // ad-level spend so the Ads view can show cost-per-lead.
  meta: {
    get accessToken() {
      return env("META_ACCESS_TOKEN");
    },
    get adAccountId() {
      return env("META_AD_ACCOUNT_ID"); // e.g. act_123456789
    },
    get apiVersion() {
      return env("META_API_VERSION") || "v21.0";
    },
    get enabled() {
      return !!this.accessToken && !!this.adAccountId;
    },
  },

  // ── Phase 3: apptics-pay (payment onboarding) ──────────────────────────────
  // Var names follow the apptics-pay platform's own convention.
  apticsPay: {
    get exportUrl() {
      return env("APPTICS_EXPORT_URL");
    },
    get exportApiKey() {
      return env("APPTICS_EXPORT_API_KEY");
    },
    get enabled() {
      return !!this.exportUrl && !!this.exportApiKey;
    },
  },

  // ── Sales bot (apptics-whatsapp service) — account linking control plane ─────
  // The dashboard proxies to the sales bot's own API server-side (so its API_KEY
  // never reaches the browser) to render live QR panels + re-link controls for
  // the WhatsApp/Telegram numbers that create groups and send booking notices.
  salesBot: {
    get url() {
      return (
        env("SALES_BOT_URL") ||
        "https://apptics-whatsapp-production.up.railway.app"
      );
    },
    get apiKey() {
      return env("SALES_BOT_API_KEY");
    },
    get enabled() {
      return !!this.url && !!this.apiKey;
    },
  },
};

/** True when at least one live source is configured — switches `data.ts` to live mode. */
export function anyLiveSource(): boolean {
  const c = integrationConfig;
  return (
    c.crm.enabled ||
    c.whatsapp.enabled ||
    c.telegram.enabled ||
    c.apticsPay.enabled
  );
}

/** Human-readable status of each source, for the Integrations page. */
export function sourceStatus() {
  const c = integrationConfig;
  return {
    crm: c.crm.enabled,
    whatsapp: c.whatsapp.enabled,
    telegram: c.telegram.enabled,
    apticsPay: c.apticsPay.enabled,
  };
}
