import { Megaphone, TrendingUp } from "lucide-react";
import { getCustomers } from "@/lib/data";
import { effectiveStage, formatCurrency } from "@/lib/journey";
import { integrationConfig } from "@/lib/integrations/config";
import { fetchAdSpend } from "@/lib/integrations/meta";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

interface AdRow {
  key: string;
  adName: string;
  campaignName?: string;
  status?: string;
  spend?: number;
  clicks?: number;
  leads: number;
  won: number;
}

export default async function AdsPage() {
  const customers = await getCustomers();
  const metaEnabled = integrationConfig.meta.enabled;

  // All ads + spend from Meta (the dashboard works even before lead capture).
  const adIndex = metaEnabled
    ? await fetchAdSpend()
    : { byId: new Map(), byName: new Map() };

  const rows = new Map<string, AdRow>();
  for (const ad of adIndex.byId.values()) {
    rows.set(ad.adId, {
      key: ad.adId,
      adName: ad.adName,
      campaignName: ad.campaignName,
      status: ad.status,
      spend: ad.spend,
      clicks: ad.clicks,
      leads: 0,
      won: 0,
    });
  }

  // Overlay attributed leads (from captured UTMs) onto their ad.
  let attributedLeads = 0;
  for (const c of customers) {
    const ad = c.attribution.ad;
    if (!ad?.adName && !ad?.adId) continue;
    attributedLeads++;
    const meta =
      (ad.adId && adIndex.byId.get(ad.adId)) ||
      (ad.adName && adIndex.byName.get(ad.adName.trim().toLowerCase())) ||
      null;
    const key = meta?.adId || ad.adId || ad.adName!;
    const row =
      rows.get(key) ??
      ({
        key,
        adName: ad.adName || ad.adId || "Unknown ad",
        campaignName: ad.campaignName,
        spend: ad.spend,
        leads: 0,
        won: 0,
      } satisfies AdRow);
    row.leads += 1;
    if (effectiveStage(c) === "won") row.won += 1;
    rows.set(key, row);
  }

  const ads = [...rows.values()].sort(
    (a, b) => (b.spend ?? 0) - (a.spend ?? 0) || b.leads - a.leads,
  );
  const totalSpend = ads.reduce((s, a) => s + (a.spend ?? 0), 0);
  const activeAds = ads.filter((a) => a.status === "ACTIVE").length;

  if (ads.length === 0) {
    return (
      <div>
        <PageHeader
          title="Facebook Ads"
          subtitle="Which ad each lead came from — leads, conversion, and cost per lead per ad."
        />
        <div className="p-6">
          <SetupGuide />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Facebook Ads"
        subtitle="Ad spend from Meta, with each lead attributed to the ad it came from."
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi label="Ad spend" value={totalSpend > 0 ? formatCurrency(totalSpend) : "—"} />
          <Kpi label="Ads" value={`${ads.length}${activeAds ? ` · ${activeAds} active` : ""}`} />
          <Kpi label="Attributed leads" value={attributedLeads} />
          <Kpi
            label="Cost / lead"
            value={
              totalSpend > 0 && attributedLeads
                ? formatCurrency(Math.round(totalSpend / attributedLeads))
                : "—"
            }
          />
        </div>

        {metaEnabled && attributedLeads === 0 && (
          <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Ad spend is live.
            </span>{" "}
            To attribute <em>which lead came from which ad</em>, tag your ad URLs
            with UTMs and capture them into the CRM — see the steps at the bottom.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>By Ad</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((a) => (
                  <TableRow key={a.key}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {a.status === "ACTIVE" && (
                          <span className="size-1.5 shrink-0 rounded-full bg-[var(--stage-won)]" />
                        )}
                        <span className="font-medium">{a.adName}</span>
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                      {a.campaignName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.spend != null ? formatCurrency(a.spend) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {a.clicks ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{a.leads || "—"}</TableCell>
                    <TableCell className="text-right">{a.won || "—"}</TableCell>
                    <TableCell className="text-right">
                      {a.spend != null && a.leads
                        ? formatCurrency(Math.round(a.spend / a.leads))
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {attributedLeads === 0 && <SetupGuide />}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function SetupGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4 text-[var(--stage-source)]" />
          Attribute leads to ads
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Spend is live from Meta. To show which lead came from which ad, tag your
          ads and capture the UTMs onto each lead.
        </p>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            In each Facebook ad, set{" "}
            <span className="font-medium">URL parameters</span> (Ad level → Tracking)
            to:
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
{`utm_source=facebook
utm_medium=paid
utm_campaign={{campaign.name}}
utm_content={{ad.name}}
fb_ad_id={{ad.id}}`}
            </pre>
            Meta fills the <code>{`{{…}}`}</code> placeholders per ad automatically.
          </li>
          <li>
            Make sure your form / Cal.com captures those URL params and writes
            them to CRM custom columns.
          </li>
          <li>
            Point the platform at those columns in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>:
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
{`CRM_AD_NAME_COLUMN=col_xxx      # holds utm_content (ad name)
CRM_AD_CAMPAIGN_COLUMN=col_yyy  # holds utm_campaign
CRM_AD_ID_COLUMN=col_zzz        # holds fb_ad_id`}
            </pre>
          </li>
        </ol>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TrendingUp className="size-3.5" />
          Once captured, each lead&apos;s ad shows on their profile and the Leads /
          Won / CPL columns above fill in per ad.
        </p>
      </CardContent>
    </Card>
  );
}
