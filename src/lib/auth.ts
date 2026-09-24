// Single-password gate for the dashboard. The password lives in AUTH_PASSWORD;
// the auth cookie stores a SHA-256 token derived from it (never the raw value),
// so it can be verified statelessly in both the Edge middleware and Node routes.

export const AUTH_COOKIE = "cjp_auth";

/** The configured dashboard password (empty = auth disabled). */
export function authPassword(): string {
  return process.env.AUTH_PASSWORD?.trim() || "";
}

/** Deterministic cookie token for a password (Web Crypto — works in edge + node). */
export async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`cjp:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
