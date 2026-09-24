import { NextResponse } from "next/server";
import { integrationConfig } from "@/lib/integrations/config";

export const dynamic = "force-dynamic";

// Live status (+ freshly-rendered QR images) of the sales bot's WhatsApp and
// Telegram sessions. Proxies the apptics-whatsapp service's /login/status so the
// bot's API_KEY never reaches the browser.
export async function GET() {
  const { url, apiKey, enabled } = integrationConfig.salesBot;
  if (!enabled) {
    return NextResponse.json(
      { error: "sales bot not configured — set SALES_BOT_URL + SALES_BOT_API_KEY" },
      { status: 503 },
    );
  }
  try {
    const res = await fetch(`${url}/login/status`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`sales bot returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
