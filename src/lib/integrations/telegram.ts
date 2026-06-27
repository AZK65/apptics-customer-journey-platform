import type { Customer, GroupMessage } from "@/lib/types";
import { integrationConfig, type WhatsAppStore } from "./config";
import { joinKey, phoneKey } from "./normalize";
import type { CustomerIndex } from "./aggregate";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2b — Telegram groups (reuses the saved gram.js session, no QR).
//
// Reads telegram-worker/store.json and, for each group, matches it to a CRM lead
// by the lead's Telegram handle (CRM `username`) or phone among the group's
// participants — then attaches the group chat + conversation + follow-ups.
// ─────────────────────────────────────────────────────────────────────────────

type StoreGroup = WhatsAppStore["groups"][number];

export async function enrichWithTelegram(index: CustomerIndex): Promise<void> {
  const store = integrationConfig.telegram.store;
  if (!store?.groups?.length) return;

  for (const g of store.groups) {
    const customer = matchCustomer(g, index);
    // Don't clobber a WhatsApp group that's already attached.
    if (!customer || customer.groupChat) continue;
    applyGroup(customer, g);
  }
}

/** A group belongs to whichever CRM lead is a participant (telegram handle / phone). */
function matchCustomer(g: StoreGroup, index: CustomerIndex): Customer | undefined {
  for (const p of g.participants ?? []) {
    if (/^\d{7,}$/.test(p)) {
      const hit = index.byPhone.get(phoneKey(p));
      if (hit) return hit;
    } else {
      const hit =
        index.byHandle.get(joinKey(p)) || index.byHandle.get(joinKey("@" + p));
      if (hit) return hit;
    }
  }
  return undefined;
}

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

  c.groupChat = {
    platform: "telegram",
    createdByBot: true,
    botName: "Apptics Telegram Bot",
    createdAt,
    memberCount: g.participants?.length ?? 0,
    lastActivityAt: messages[messages.length - 1]?.at,
    messages,
    ref: g.id,
  };

  const followUps = messages
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.fromMe && m.body.trim())
    .map(({ m, i }) => ({
      by: "bot" as const,
      actorName: "Apptics Telegram Bot",
      channel: "telegram" as const,
      at: m.at,
      message: m.body.length > 160 ? m.body.slice(0, 157) + "…" : m.body,
      responded: messages.slice(i + 1).some((n) => !n.fromMe),
    }));
  if (followUps.length) c.followUps = followUps;
}
