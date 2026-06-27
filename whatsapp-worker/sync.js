// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp worker for the Customer Journey Platform.
//
// Links the Apptics WhatsApp number as a *linked device* (scan the QR once),
// then continuously syncs every group's participants + messages to
// whatsapp-worker/store.json. The Next app reads that file — no API, no keys.
//
// Run:  pnpm whatsapp:link      (scan the QR with the Apptics number)
// The session persists in whatsapp-worker/.wwebjs-auth (scan only once).
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcodeTerminal = require("qrcode-terminal");

const DIR = __dirname;
// In production these point at the mounted volume (set via env); locally they
// default to the worker folder.
const STORE = process.env.WHATSAPP_DATA_PATH || path.join(DIR, "store.json");
const AUTH = process.env.WWEBJS_AUTH_PATH || path.join(DIR, ".wwebjs-auth");
const MSG_LIMIT = Number(process.env.WA_MSG_LIMIT || 50);

let state = { status: "starting", qr: null, me: null, updatedAt: null, groups: [] };

function writeStore(patch) {
  state = { ...state, ...patch, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  const tmp = STORE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STORE);
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: AUTH }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("\nScan this QR with the Apptics WhatsApp number:");
  console.log("  WhatsApp → Settings → Linked Devices → Link a Device\n");
  qrcodeTerminal.generate(qr, { small: true });
  writeStore({ status: "qr", qr });
});

client.on("authenticated", () => console.log("[wa] authenticated"));
client.on("auth_failure", (m) => console.error("[wa] auth failure:", m));

client.on("ready", async () => {
  const me = client.info?.wid?.user || null;
  console.log(`[wa] connected as ${me}. Syncing groups…`);
  writeStore({ status: "connected", qr: null, me });
  await syncAll();
  console.log(`[wa] synced ${state.groups.length} groups → ${STORE}`);
});

client.on("disconnected", (r) => {
  console.warn("[wa] disconnected:", r);
  writeStore({ status: "disconnected" });
});

// Re-sync (debounced) whenever a message arrives in any chat.
let timer = null;
client.on("message", scheduleSync);
client.on("message_create", scheduleSync);
function scheduleSync() {
  clearTimeout(timer);
  timer = setTimeout(() => syncAll().catch(() => {}), 3000);
}
// Safety net: full re-sync every 2 minutes.
setInterval(() => syncAll().catch(() => {}), 120_000);

async function syncAll() {
  if (state.status !== "connected") return;
  const chats = await client.getChats();
  const groups = [];
  for (const chat of chats) {
    if (!chat.isGroup) continue;
    let participants = [];
    try {
      participants = (chat.participants || []).map((p) => p.id.user);
    } catch {
      /* ignore */
    }
    let messages = [];
    try {
      const msgs = await chat.fetchMessages({ limit: MSG_LIMIT });
      messages = msgs
        .map((m) => ({
          id: (m.id && (m.id._serialized || m.id.id)) || String(m.timestamp),
          at: m.timestamp ? new Date(m.timestamp * 1000).toISOString() : null,
          fromMe: !!m.fromMe,
          author: (m.author && m.author.replace(/@.*/, "")) || null,
          body: m.body || "",
        }))
        .filter((m) => m.body);
    } catch (e) {
      console.warn("[wa] fetchMessages failed for", chat.name, e && e.message);
    }
    groups.push({
      id: chat.id._serialized,
      name: chat.name || "",
      participants,
      messages,
    });
  }
  writeStore({ groups });
}

console.log("[wa] starting worker… (store:", STORE + ")");
writeStore({ status: "starting" });
client.initialize().catch((e) => {
  console.error("[wa] init failed:", e);
  writeStore({ status: "error" });
});
