import { NextResponse } from "next/server";
import { accountsStatus } from "@/lib/integrations/accounts";

export const dynamic = "force-dynamic";

// Live status (+ freshly-rendered QR images) of the WhatsApp and Telegram
// accounts. Comes from the in-container workers, or is proxied from the external
// sales bot when SALES_BOT_URL + SALES_BOT_API_KEY are set (key stays server-side).
export async function GET() {
  try {
    return NextResponse.json(await accountsStatus());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
