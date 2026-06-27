import { integrationConfig } from "./config";

// ─────────────────────────────────────────────────────────────────────────────
// Facebook / Meta Marketing API — ad-level metadata + spend.
//
// Optional: per-lead "which ad" works from captured UTMs alone. This only adds
// ad-level spend (and canonical ad/adset/campaign names) so the Ads view can
// show cost-per-lead. Needs META_ACCESS_TOKEN (ads_read) + META_AD_ACCOUNT_ID.
// ─────────────────────────────────────────────────────────────────────────────

export interface AdInsight {
  adId: string;
  adName: string;
  adsetName?: string;
  campaignName?: string;
  status?: string; // effective_status: ACTIVE | PAUSED | …
  spend: number;
  impressions?: number;
  clicks?: number;
}

export interface AdSpendIndex {
  byId: Map<string, AdInsight>;
  byName: Map<string, AdInsight>;
}

interface MetaAdNode {
  id: string;
  name?: string;
  effective_status?: string;
  adset?: { name?: string };
  campaign?: { name?: string };
  insights?: { data?: { spend?: string; impressions?: string; clicks?: string }[] };
}

/** Pull every ad with its lifetime spend, indexed by id and (lowercased) name. */
export async function fetchAdSpend(): Promise<AdSpendIndex> {
  const { accessToken, adAccountId, apiVersion } = integrationConfig.meta;
  const empty: AdSpendIndex = { byId: new Map(), byName: new Map() };
  if (!accessToken || !adAccountId) return empty;

  const fields =
    "id,name,effective_status,adset{name},campaign{name},insights.date_preset(maximum){spend,impressions,clicks}";
  let url =
    `https://graph.facebook.com/${apiVersion}/${adAccountId}/ads` +
    `?fields=${encodeURIComponent(fields)}&limit=200&access_token=${encodeURIComponent(accessToken)}`;

  const byId = new Map<string, AdInsight>();
  const byName = new Map<string, AdInsight>();

  try {
    for (let page = 0; page < 20 && url; page++) {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.error(`[meta] HTTP ${res.status} fetching ads`);
        break;
      }
      const json = (await res.json()) as {
        data?: MetaAdNode[];
        paging?: { next?: string };
        error?: { message: string };
      };
      if (json.error) {
        console.error("[meta] API error:", json.error.message);
        break;
      }
      for (const a of json.data ?? []) {
        const ins = a.insights?.data?.[0];
        const insight: AdInsight = {
          adId: a.id,
          adName: a.name ?? a.id,
          adsetName: a.adset?.name,
          campaignName: a.campaign?.name,
          status: a.effective_status,
          spend: ins?.spend ? Number(ins.spend) : 0,
          impressions: ins?.impressions ? Number(ins.impressions) : undefined,
          clicks: ins?.clicks ? Number(ins.clicks) : undefined,
        };
        byId.set(insight.adId, insight);
        if (a.name) byName.set(a.name.trim().toLowerCase(), insight);
      }
      url = json.paging?.next ?? "";
    }
  } catch (err) {
    console.error("[meta] fetch failed:", (err as Error).message);
  }

  return { byId, byName };
}
