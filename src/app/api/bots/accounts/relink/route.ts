import { NextResponse } from "next/server";
import { integrationConfig } from "@/lib/integrations/config";

export const dynamic = "force-dynamic";

// Trigger a re-link / reset on the sales bot.
//   POST { target: "whatsapp" }                                    → wipes WA session, new QR
//   POST { target: "telegram", password?: string }                 → starts Telegram QR login
//   POST { target: "telegram", action: "reset" }                   → logs out + clears Telegram
export async function POST(req: Request) {
  const { url, apiKey, enabled } = integrationConfig.salesBot;
  if (!enabled) {
    return NextResponse.json(
      { error: "sales bot not configured — set SALES_BOT_URL + SALES_BOT_API_KEY" },
      { status: 503 },
    );
  }
  let body: { target?: string; password?: string; action?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const target = body.target;
  const action = body.action || "relink";
  let path: string | null = null;
  if (target === "whatsapp") path = "/relink-whatsapp";
  else if (target === "telegram")
    path = action === "reset" ? "/reset-telegram" : "/relink-telegram";
  if (!path) {
    return NextResponse.json(
      { error: "target must be 'whatsapp' or 'telegram'" },
      { status: 400 },
    );
  }
  try {
    const res = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(
        target === "telegram" ? { password: body.password || "" } : {},
      ),
    });
    if (!res.ok) throw new Error(`sales bot returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
