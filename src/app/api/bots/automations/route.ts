import { NextResponse } from "next/server";
import { integrationConfig } from "@/lib/integrations/config";

export const dynamic = "force-dynamic";

// Proxy the sales bot's automation config (reminders, follow-ups, no-show, quiet
// hours, create-chat). Keeps the bot's API key server-side.
export async function GET() {
  const { url, apiKey, enabled } = integrationConfig.salesBot;
  if (!enabled) {
    return NextResponse.json(
      { error: "sales bot not configured — set SALES_BOT_URL + SALES_BOT_API_KEY" },
      { status: 503 },
    );
  }
  try {
    const res = await fetch(`${url}/config`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`sales bot /config → ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function PUT(req: Request) {
  const { url, apiKey, enabled } = integrationConfig.salesBot;
  if (!enabled) {
    return NextResponse.json(
      { error: "sales bot not configured — set SALES_BOT_URL + SALES_BOT_API_KEY" },
      { status: 503 },
    );
  }
  try {
    const body = await req.json();
    const res = await fetch(`${url}/config`, {
      method: "PUT",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`sales bot /config → ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
