import crypto from "node:crypto";
import { upsertAdEntry, adStoreCount } from "@/lib/integrations/ad-store";
import type { AdAttribution } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Cal.com webhook receiver — captures the Facebook ad a booking came from.
//
// Configure in Cal.com → Settings → Developer → Webhooks:
//   URL: https://<your-app>/api/cal-hook   ·   Trigger: Booking Created
//   (optional) Secret → set CAL_WEBHOOK_SECRET to verify X-Cal-Signature-256.
//
// The booker reaches Cal.com from a FB ad whose URL carries
//   ?utm_source=facebook&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&fb_ad_id={{ad.id}}
// Cal.com forwards those, and we store them keyed by the booker's email/phone.
// The aggregator then attaches the ad to the matching CRM lead.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Json = Record<string, unknown>;
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/** Pull a key from any of the places Cal.com may stash UTM/query params. */
function pick(payload: Json, keys: string[]): string | undefined {
  const buckets: Json[] = [
    payload,
    (payload.tracking as Json) || {},
    (payload.metadata as Json) || {},
    (payload.responses as Json) || {},
  ];
  for (const k of keys) {
    for (const b of buckets) {
      const v = b?.[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      // Cal.com responses are often { value: "..." }
      if (v && typeof v === "object" && "value" in (v as Json)) {
        const inner = (v as Json).value;
        if (typeof inner === "string" && inner.trim()) return inner.trim();
      }
    }
  }
  return undefined;
}

function attendee(payload: Json): { email?: string; phone?: string } {
  const list = (payload.attendees as Json[]) || [];
  const first = list[0] || {};
  return {
    email: str(first.email) || pick(payload, ["email"]),
    phone:
      str(first.phoneNumber) ||
      pick(payload, ["phone", "phoneNumber", "attendeePhoneNumber", "smsReminderNumber"]),
  };
}

export async function POST(req: Request) {
  const secret = process.env.CAL_WEBHOOK_SECRET?.trim();
  // Cal.com signs with HMAC-SHA256 hex of the raw body in X-Cal-Signature-256.
  const raw = await req.text();
  if (secret) {
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const got = req.headers.get("x-cal-signature-256") || "";
    if (got !== expected) {
      return Response.json({ error: "invalid_signature" }, { status: 401 });
    }
  }

  let body: Json;
  try {
    body = JSON.parse(raw) as Json;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const payload = (body.payload as Json) || body;
  const { email, phone } = attendee(payload);

  const adName = pick(payload, ["utm_content", "utmContent", "ad", "ad_name"]);
  const campaignName = pick(payload, ["utm_campaign", "utmCampaign", "campaign"]);
  const adId = pick(payload, ["fb_ad_id", "fbAdId", "ad_id", "adId"]);
  const device = pick(payload, ["device", "device_type", "deviceType"]);

  if (!adName && !adId && !device) {
    return Response.json({ ok: true, ignored: "no ad / device params on booking" });
  }
  if (!email && !phone) {
    return Response.json({ ok: true, ignored: "no attendee email/phone" });
  }

  const ad: AdAttribution | undefined =
    adName || adId ? { platform: "facebook", adId, adName, campaignName } : undefined;
  const { keys } = upsertAdEntry({ email, phone, ad, device, via: "cal.com" });

  console.log(
    `[cal-hook] captured ${ad ? `ad "${adName ?? adId}" ` : ""}${device ? `device "${device}" ` : ""}for ${email ?? phone} (${keys.length} keys)`,
  );
  return Response.json({ ok: true, captured: { adName, campaignName, adId, device }, keys });
}

export async function GET() {
  return Response.json({
    ok: true,
    endpoint: "cal-hook",
    capturedEntries: adStoreCount(),
    secretConfigured: !!process.env.CAL_WEBHOOK_SECRET,
  });
}
