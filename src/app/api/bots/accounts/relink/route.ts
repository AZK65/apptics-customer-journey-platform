import { NextResponse } from "next/server";
import { integrationConfig } from "@/lib/integrations/config";
import { sendLocalCommand } from "@/lib/integrations/accounts";

export const dynamic = "force-dynamic";

// Trigger a re-link on WhatsApp / Telegram.
//   POST { target: "whatsapp" }                                → wipes WA session, new QR
//   POST { target: "telegram" }                                → logs out + new Telegram QR
//   POST { target: "telegram", action: "password", password }  → submits the 2FA password
export async function POST(req: Request) {
  let body: { target?: string; password?: string; action?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const target = body.target;
  const action = body.action || "relink";
  if (target !== "whatsapp" && target !== "telegram") {
    return NextResponse.json(
      { error: "target must be 'whatsapp' or 'telegram'" },
      { status: 400 },
    );
  }

  if (!integrationConfig.salesBot.enabled) {
    if (action === "password") {
      if (target !== "telegram" || !body.password) {
        return NextResponse.json({ error: "password required" }, { status: 400 });
      }
      sendLocalCommand("telegram", { action: "password", password: body.password });
    } else {
      sendLocalCommand(target, { action: "relink" });
    }
    return NextResponse.json({ ok: true });
  }

  // External sales bot.
  const { url, apiKey } = integrationConfig.salesBot;
  let path = "/relink-whatsapp";
  if (target === "telegram") path = action === "reset" ? "/reset-telegram" : "/relink-telegram";
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
