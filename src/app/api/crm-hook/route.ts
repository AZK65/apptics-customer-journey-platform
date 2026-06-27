import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { integrationConfig } from "@/lib/integrations/config";

// ─────────────────────────────────────────────────────────────────────────────
// Apptics Sales CRM webhook receiver.
//
// Register this URL with the CRM:
//   POST https://sales.apptics.org/api/v1/webhooks  { "url": "<this route>" }
// The CRM returns a `secret` — put it in CRM_WEBHOOK_SECRET so we can verify the
// X-CRM-Signature-256 (HMAC-SHA256 of the raw body).
//
// On a verified lead.created / lead.won / lead.lost event we revalidate the
// journey views so the change shows up immediately.
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verify(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const secret = integrationConfig.crm.webhookSecret;
  const rawBody = await req.text();

  // If a secret is configured, enforce the signature. (If not, accept but warn —
  // useful while wiring things up locally.)
  if (secret) {
    const sig = req.headers.get("x-crm-signature-256");
    if (!verify(rawBody, sig, secret)) {
      return Response.json({ error: "invalid_signature" }, { status: 401 });
    }
  } else {
    console.warn("[crm-hook] CRM_WEBHOOK_SECRET not set — skipping signature check");
  }

  let event = req.headers.get("x-crm-event") ?? "unknown";
  try {
    const body = JSON.parse(rawBody) as { event?: string; data?: { id?: number } };
    event = body.event ?? event;
    console.log(`[crm-hook] ${event} for lead ${body.data?.id ?? "?"}`);
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  // Push the change into the UI by refreshing the journey views.
  for (const path of ["/", "/board", "/customers"]) {
    revalidatePath(path);
  }

  return Response.json({ ok: true, event });
}

// Allow a quick browser/GET health check.
export async function GET() {
  return Response.json({
    ok: true,
    endpoint: "apptics-sales-crm-webhook",
    secretConfigured: !!integrationConfig.crm.webhookSecret,
  });
}
