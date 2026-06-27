// ─────────────────────────────────────────────────────────────────────────────
// Telegram worker for the Customer Journey Platform.
//
// Reuses the already-authenticated Telegram user session (TELEGRAM_SESSION) — no
// QR / login needed. Syncs every group's participants + messages to
// telegram-worker/store.json, which the Next app reads (no API, no keys beyond
// the session that already exists).
//
// Run:  pnpm telegram:sync     (loads .env.local for the session creds)
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");

const DIR = __dirname;
const STORE = process.env.TELEGRAM_DATA_PATH || path.join(DIR, "store.json");
const MSG_LIMIT = Number(process.env.TG_MSG_LIMIT || 50);

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const session = process.env.TELEGRAM_SESSION;

let state = { status: "connecting", me: null, updatedAt: null, groups: [] };

function writeStore(patch) {
  state = { ...state, ...patch, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  const tmp = STORE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STORE);
}

if (!apiId || !apiHash || !session) {
  console.error(
    "[tg] Missing TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_SESSION (run with `pnpm telegram:sync`).",
  );
  writeStore({ status: "error" });
  process.exit(1);
}

const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
  connectionRetries: 3,
});

const norm = (u) => String(u || "").replace(/^@/, "").trim().toLowerCase();

async function syncAll() {
  if (state.status !== "connected") return;
  try {
    const dialogs = await client.getDialogs({ limit: 200 });
    const groups = [];
    for (const d of dialogs) {
      if (!(d.isGroup || (d.isChannel && d.entity?.megagroup))) continue;
      const entity = d.entity;
      const handles = [];
      try {
        const parts = await client.getParticipants(entity, { limit: 120 });
        for (const u of parts) {
          if (u.username) handles.push(norm(u.username));
          if (u.phone) handles.push(String(u.phone).replace(/\D/g, ""));
        }
      } catch {
        /* some groups disallow participant listing */
      }
      let messages = [];
      try {
        const msgs = await client.getMessages(entity, { limit: MSG_LIMIT });
        messages = msgs
          .map((m) => ({
            id: String(m.id),
            at: m.date ? new Date(m.date * 1000).toISOString() : null,
            fromMe: !!m.out,
            author: m.senderId ? String(m.senderId) : null,
            body: m.message || "",
          }))
          .filter((m) => m.body)
          .reverse();
      } catch {
        /* ignore */
      }
      groups.push({
        id: String(d.id),
        name: d.title || "",
        participants: [...new Set(handles)],
        messages,
      });
    }
    writeStore({ groups });
    console.log(`[tg] synced ${groups.length} groups → ${STORE}`);
  } catch (e) {
    console.error("[tg] sync failed:", e && e.message);
  }
}

let timer = null;
const scheduleSync = () => {
  clearTimeout(timer);
  timer = setTimeout(() => syncAll().catch(() => {}), 3000);
};

(async () => {
  console.log("[tg] connecting with saved session…");
  try {
    await client.connect();
    const me = await client.getMe();
    const meName = me?.username || me?.firstName || String(me?.id || "");
    console.log(`[tg] connected as ${meName}. Syncing groups…`);
    writeStore({ status: "connected", me: meName });
    await syncAll();
    client.addEventHandler(scheduleSync, new NewMessage({}));
    setInterval(() => syncAll().catch(() => {}), 120_000);
  } catch (e) {
    console.error("[tg] connect failed:", e && e.message);
    writeStore({ status: "error" });
    process.exit(1);
  }
})();
