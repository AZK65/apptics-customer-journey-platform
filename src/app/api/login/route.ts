import { NextResponse } from "next/server";
import { AUTH_COOKIE, authPassword, tokenFor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const pw = authPassword();
  if (!pw) {
    return NextResponse.json(
      { error: "Auth not configured (set AUTH_PASSWORD)" },
      { status: 500 },
    );
  }
  let password = "";
  try {
    ({ password } = await req.json());
  } catch {}
  if (!password || password !== pw) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await tokenFor(pw), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
