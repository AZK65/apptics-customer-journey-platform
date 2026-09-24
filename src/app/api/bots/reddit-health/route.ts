import { NextResponse } from "next/server";

const CAMOFOX_URL = process.env.CAMOFOX_URL || process.env.REDDIT_BOT_CAMOFOX_URL || "http://localhost:9377";

interface ProfileData {
  postKarma: number;
  commentKarma: number;
  totalKarma: number;
  accountAge: string;
  health: "healthy" | "warning" | "suspended" | "new";
}

async function fetchViaRedditApi(username: string): Promise<ProfileData | null> {
  try {
    const res = await fetch(
      `https://www.reddit.com/user/${username}/about.json`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) return null;

    const json = await res.json();
    const data = json?.data;
    if (!data) return null;

    const postKarma = data.link_karma ?? 0;
    const commentKarma = data.comment_karma ?? 0;
    const totalKarma = data.total_karma ?? postKarma + commentKarma;
    const createdUtc = data.created_utc ?? 0;

    const ageDays = Math.floor((Date.now() / 1000 - createdUtc) / 86400);
    let accountAge: string;
    if (ageDays < 30) accountAge = `${ageDays}d`;
    else if (ageDays < 365) accountAge = `${Math.floor(ageDays / 30)}mo`;
    else {
      const years = Math.floor(ageDays / 365);
      const months = Math.floor((ageDays % 365) / 30);
      accountAge = months > 0 ? `${years}y ${months}mo` : `${years}y`;
    }

    let health: ProfileData["health"] = "healthy";
    if (data.is_suspended) health = "suspended";
    else if (totalKarma < 10) health = "new";
    else if (commentKarma < 0 || postKarma < 0) health = "warning";

    return { postKarma, commentKarma, totalKarma, accountAge, health };
  } catch {
    return null;
  }
}

async function fetchViaCamoufox(username: string): Promise<ProfileData | null> {
  try {
    const healthCheck = await fetch(`${CAMOFOX_URL}/health`).catch(() => null);
    if (!healthCheck?.ok) return null;

    const userId = `health-check-${username}`;
    const tabRes = await fetch(`${CAMOFOX_URL}/tabs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        sessionKey: "health",
        url: `https://www.reddit.com/user/${username}`,
      }),
    });
    if (!tabRes.ok) return null;

    const { tabId } = await tabRes.json();

    await new Promise((r) => setTimeout(r, 4000));

    const snapRes = await fetch(
      `${CAMOFOX_URL}/tabs/${tabId}/snapshot?userId=${userId}`,
    );
    const { snapshot } = await snapRes.json();

    await fetch(`${CAMOFOX_URL}/tabs/${tabId}?userId=${userId}`, {
      method: "DELETE",
    }).catch(() => {});

    if (!snapshot) return null;

    const karmaMatch = snapshot.match(
      /(\d[\d,]*)\s*karma/i,
    );
    const postKarmaMatch = snapshot.match(
      /(\d[\d,]*)\s*post\s*karma/i,
    );
    const commentKarmaMatch = snapshot.match(
      /(\d[\d,]*)\s*comment\s*karma/i,
    );
    const ageMatch = snapshot.match(
      /(\d+[ymd]\s*(?:\d+[ymd])?)\s*(?:old|cake)/i,
    ) || snapshot.match(/Redditor since/i);

    const parseNum = (s?: string) =>
      s ? parseInt(s.replace(/,/g, ""), 10) || 0 : 0;

    const totalKarma = parseNum(karmaMatch?.[1]);
    const postKarma = parseNum(postKarmaMatch?.[1]);
    const commentKarma = parseNum(commentKarmaMatch?.[1]);

    const isSuspended =
      snapshot.toLowerCase().includes("suspended") ||
      snapshot.toLowerCase().includes("this account has been suspended");

    let health: ProfileData["health"] = "healthy";
    if (isSuspended) health = "suspended";
    else if (totalKarma < 10) health = "new";
    else if (commentKarma < 0 || postKarma < 0) health = "warning";

    return {
      postKarma,
      commentKarma,
      totalKarma,
      accountAge: ageMatch?.[1] || "—",
      health,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  // Try Reddit's public JSON API first, fall back to Camoufox
  let profile = await fetchViaRedditApi(username);

  if (!profile) {
    profile = await fetchViaCamoufox(username);
  }

  if (!profile) {
    return NextResponse.json({
      username,
      postKarma: 0,
      commentKarma: 0,
      totalKarma: 0,
      accountAge: "—",
      health: "unknown",
      error: "Could not fetch profile. Reddit API blocked and Camoufox not available.",
    });
  }

  return NextResponse.json({
    username,
    ...profile,
  });
}
