import type { Customer, GroupMessage } from "@/lib/types";
import { integrationConfig, type WhatsAppStore } from "./config";
import { phoneKey } from "./normalize";
import type { CustomerIndex } from "./aggregate";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — WhatsApp groups (QR-linked, no API).
//
// Reads whatsapp-worker/store.json (produced by the linked whatsapp-web.js
// session) and, for every group, matches it to a CRM customer by participant
// phone — then attaches the real group chat, its conversation, and the derived
// follow-up signals. No URL, no keys: the worker just has to be linked & running.
// ─────────────────────────────────────────────────────────────────────────────

type StoreGroup = WhatsAppStore["groups"][number];

export async function enrichWithWhatsApp(index: CustomerIndex): Promise<void> {
  const store = integrationConfig.whatsapp.store;
  if (!store?.groups?.length) return;

  for (const g of store.groups) {
    const customer = matchCustomer(g, index);
    if (!customer) continue;
    applyGroup(customer, g);
  }
}

/** A group belongs to whichever CRM lead is a participant (by phone). */
function matchCustomer(g: StoreGroup, index: CustomerIndex): Customer | undefined {
  for (const p of g.participants ?? []) {
    const pk = phoneKey(p);
    if (pk.length >= 7) {
      const hit = index.byPhone.get(pk);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Attach the group chat + conversation + follow-ups to a customer. */
export function applyGroup(c: Customer, g: StoreGroup): void {
  const messages: GroupMessage[] = (g.messages ?? [])
    .filter((m) => m.body?.trim())
    .map((m) => ({
      id: m.id,
      at: m.at,
      fromMe: !!m.fromMe,
      author: m.author ?? undefined,
      body: m.body,
    }))
    .sort((a, b) => +new Date(a.at) - +new Date(b.at));

  const createdAt = messages[0]?.at ?? c.createdAt;
  const lastActivityAt = messages[messages.length - 1]?.at;

  c.groupChat = {
    platform: "whatsapp",
    createdByBot: true,
    botName: "Apptics WhatsApp Bot",
    createdAt,
    memberCount: g.participants?.length ?? 0,
    lastActivityAt,
    messages,
    ref: g.id,
  };

  attachFollowUps(c, messages);
}

/** Each outbound message from our side is a touch; "responded" if the customer
 *  replied afterward. Drives the journey's follow-up signals from the real chat. */
function attachFollowUps(c: Customer, messages: GroupMessage[]): void {
  const followUps = messages
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.fromMe && m.body.trim())
    .map(({ m, i }) => ({
      by: "bot" as const,
      actorName: c.groupChat?.botName ?? "Apptics",
      channel: "whatsapp" as const,
      at: m.at,
      message: m.body.length > 160 ? m.body.slice(0, 157) + "…" : m.body,
      responded: messages.slice(i + 1).some((n) => !n.fromMe),
    }));
  if (followUps.length) c.followUps = followUps;
}
