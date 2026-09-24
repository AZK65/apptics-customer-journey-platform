import { NextResponse } from "next/server";

const BOT_URL = process.env.REDDIT_BOT_URL || "http://localhost:3002";
const BOT_API_KEY = process.env.REDDIT_BOT_API_KEY || "";

function headers() {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (BOT_API_KEY) h["Authorization"] = `Bearer ${BOT_API_KEY}`;
  return h;
}

export async function GET() {
  try {
    const res = await fetch(`${BOT_URL}/api/sources`, { headers: headers() });
    if (!res.ok) throw new Error(`Bot returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 502 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${BOT_URL}/api/sources`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Bot returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 502 },
    );
  }
}
