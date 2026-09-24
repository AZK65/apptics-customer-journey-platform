import type { Customer, GroupMessage } from "@/lib/types";
import { integrationConfig } from "./config";
import type { CustomerIndex } from "./aggregate";
import { joinKey, phoneKey } from "./normalize";

// ─────────────────────────────────────────────────────────────────────────────
// Sales-bot group reader.
//
// The apptics-whatsapp sales bot is what actually CREATES the WhatsApp/Telegram
// group for each booking and holds the live sessions. Rather than stand up a
// second WhatsApp/Telegram connection on the dashboard, we read the groups (and
// their live conversations) straight from the bot's own API:
//
//   GET /bookings                      → which lead has which group (metadata)
//   GET /messages?channel=&groupId=    → the live conversation (detail view)
//
// List-level enrichment attaches group presence only (one cheap call); the full
// conversation is fetched lazily when a single customer is opened.
// ─────────────────────────────────────────────────────────────────────────────

interface SalesBooking {
  id: string;
  name?: string;
  phone?: string;
  telegram?: string;
  when?: string;
  groupCreatedAt?: string;
  group?: {
    channel: "whatsapp" | "telegram";
    groupId: string;
    title?: string;
  } | null;
}

async function salesFetch(path: string): Promise<unknown> {
  const { url, apiKey } = integrationConfig.salesBot;
  const res = await fetch(`${url}${path}`, {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`sales bot ${path} → ${res.status}`);
  return res.json();
}

function matchCustomer(
  index: CustomerIndex,
  b: SalesBooking,
): Customer | undefined {
  if (b.telegram) {
    const c = index.byHandle.get(joinKey(b.telegram));
    if (c) return c;
  }
  if (b.phone) {
    const pk = phoneKey(b.phone);
    if (pk.length >= 7) {
      const c = index.byPhone.get(pk);
      if (c) return c;
    }
  }
  return undefined;
}

/**
 * Attach each sales-bot-created group to the matched customer (presence +
 * metadata only — no messages at list scale). No-op if the bot is unreachable,
 * so group data is simply absent rather than mocked.
 */
export async function enrichWithSalesBotGroups(
  index: CustomerIndex,
): Promise<void> {
  let bookings: SalesBooking[] = [];
  try {
    bookings = (await salesFetch("/bookings")) as SalesBooking[];
  } catch {
    return;
  }
  for (const b of bookings) {
    if (!b.group?.groupId) continue;
    const c = matchCustomer(index, b);
    if (!c || c.groupChat) continue;
    c.groupChat = {
      platform: b.group.channel,
      createdByBot: true,
      botName: "Apptics Sales Bot",
      createdAt: b.groupCreatedAt || b.when || new Date().toISOString(),
      memberCount: 2, // lead + Apptics; refined from authors in the detail view
      ref: `${b.group.channel}:${b.group.groupId}`,
    };
  }
}

/** Fetch the live conversation for one group from the sales bot. */
export async function fetchSalesBotMessages(
  channel: string,
  groupId: string,
): Promise<GroupMessage[]> {
  try {
    const data = (await salesFetch(
      `/messages?channel=${encodeURIComponent(channel)}&groupId=${encodeURIComponent(groupId)}&limit=100`,
    )) as {
      messages?: {
        id: string;
        at: string | null;
        fromMe: boolean;
        author?: string | null;
        body: string;
      }[];
    };
    return (data.messages || []).map((m) => ({
      id: m.id,
      at: m.at || new Date().toISOString(),
      fromMe: !!m.fromMe,
      author: m.author || undefined,
      body: m.body,
    }));
  } catch {
    return [];
  }
}

/** Populate a customer's group conversation from its `ref` (detail view). */
export async function attachSalesBotMessages(c: Customer): Promise<void> {
  const ref = c.groupChat?.ref;
  if (!ref || !c.groupChat) return;
  const sep = ref.indexOf(":");
  if (sep < 0) return;
  const channel = ref.slice(0, sep);
  const groupId = ref.slice(sep + 1);
  if (!channel || !groupId) return;
  const messages = await fetchSalesBotMessages(channel, groupId);
  if (!messages.length) return;
  c.groupChat.messages = messages;
  c.groupChat.lastActivityAt = messages[messages.length - 1]?.at;
  // Refine member count from distinct participants seen in the conversation.
  const authors = new Set(messages.filter((m) => !m.fromMe && m.author).map((m) => m.author));
  c.groupChat.memberCount = Math.max(2, authors.size + 1);
}
