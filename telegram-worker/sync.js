// ─────────────────────────────────────────────────────────────────────────────
// Telegram worker for the Customer Journey Platform.
//
// Links a Telegram account by QR (Bots → Sales Bot Accounts on the dashboard),
// saves the session to the data volume, then syncs every group's participants +
// messages to telegram-worker/store.json, which the Next app reads.
//
// Session: telegram-session.txt next to the store (written after a QR link).
// Falls back to TELEGRAM_SESSION from env if that file doesn't exist yet.
// Commands from the dashboard arrive in telegram-control.json next to the store:
//   { action: "relink" }                 → log out, clear session, new QR
//   { action: "password", password }     → 2FA password after scanning
//
// Run:  pnpm telegram:sync     (loads .env.local for TELEGRAM_API_ID/HASH)
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");

const DIR = __dirname;
const STORE = process.env.TELEGRAM_DATA_PATH || path.join(DIR, "store.json");
const DATA_DIR = path.dirname(STORE);
const SESSION_FILE = path.join(DATA_DIR, "telegram-session.txt");
const CONTROL = path.join(DATA_DIR, "telegram-control.json");
const MSG_LIMIT = Number(process.env.TG_MSG_LIMIT || 50);
const QR_WINDOW_MS = 5 * 60_000; // stop offering QR codes after 5 min idle

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

let state = {
  status: "starting",
  qr: null,
  me: null,
  error: null,
  hint: null,
  updatedAt: null,
  groups: [],
};

function writeStore(patch) {
  state = { ...state, ...patch, updatedAt: new Date().toISOString() };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = STORE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STORE);
}

function loadSession() {
  try {
    return fs.readFileSync(SESSION_FILE, "utf8").trim();
  } catch {
    return (process.env.TELEGRAM_SESSION || "").trim();
  }
}

function saveSession(str) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SESSION_FILE, str, { mode: 0o600 });
}

const norm = (u) => String(u || "").replace(/^@/, "").trim().toLowerCase();

let client = null;

// ── Dashboard commands ──────────────────────────────────────────────────────
let pendingPassword = null; // resolver while we wait for a 2FA password
let restarting = false;

setInterval(() => {
  let cmd;
  try {
    cmd = JSON.parse(fs.readFileSync(CONTROL, "utf8"));
    fs.rmSync(CONTROL, { force: true });
  } catch {
    return;
  }
  if (cmd.action === "password" && pendingPassword) {
    const resolve = pendingPassword;
    pendingPassword = null;
    writeStore({ status: "checking", error: null });
    resolve(String(cmd.password || ""));
  } else if (cmd.action === "relink" || cmd.action === "reset") {
    console.log("[tg] re-link requested from dashboard");
    relink();
  }
}, 1500);

// Log out (if signed in), forget the session, and restart → fresh QR.
async function relink() {
  if (restarting) return;
  restarting = true;
  const wasConnected = state.status === "connected";
  writeStore({ status: "starting", qr: null, me: null, error: null, hint: null, groups: [] });
  if (client && wasConnected) {
    await Promise.race([
      client.invoke(new Api.auth.LogOut()),
      new Promise((r) => setTimeout(r, 10_000)),
    ]).catch(() => {});
  }
  if (apiId && apiHash) saveSession(""); // empty file = "no session" (don't fall back to env)
  if (client) {
    await Promise.race([client.disconnect(), new Promise((r) => setTimeout(r, 5_000))]).catch(
      () => {},
    );
  }
  process.exit(0); // boot.mjs restarts us
}

// ── Group sync ──────────────────────────────────────────────────────────────
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

async function goLive() {
  const me = await client.getMe();
  const meName = me?.username ? `@${me.username}` : me?.firstName || String(me?.id || "");
  console.log(`[tg] connected as ${meName}. Syncing groups…`);
  writeStore({ status: "connected", me: meName, qr: null, error: null, hint: null });
  await syncAll();
  client.addEventHandler(scheduleSync, new NewMessage({}));
  setInterval(() => syncAll().catch(() => {}), 120_000);
}

// ── QR login ────────────────────────────────────────────────────────────────
async function qrLogin() {
  const deadline = Date.now() + QR_WINDOW_MS;
  await client.signInUserWithQrCode(
    { apiId, apiHash },
    {
      qrCode: async ({ token }) => {
        if (Date.now() > deadline) throw new Error("QR_WINDOW_EXPIRED");
        const url = `tg://login?token=${Buffer.from(token).toString("base64url")}`;
        console.log("[tg] new login QR ready — scan it from the dashboard");
        writeStore({ status: "qr", qr: url, error: null });
      },
      password: async (hint) => {
        console.log("[tg] 2FA password needed — waiting for the dashboard");
        writeStore({
          status: "password",
          qr: null,
          hint: hint || null,
          error: state.status === "checking" ? "Wrong password — try again." : null,
        });
        return new Promise((resolve) => {
          pendingPassword = resolve;
        });
      },
      onError: async (err) => {
        const msg = (err && (err.errorMessage || err.message)) || String(err);
        console.error("[tg] login error:", msg);
        // Wrong 2FA password → ask again; anything else → stop.
        return !/PASSWORD_HASH_INVALID/.test(msg);
      },
    },
  );
  saveSession(client.session.save());
}

(async () => {
  if (!apiId || !apiHash) {
    console.error("[tg] Missing TELEGRAM_API_ID / TELEGRAM_API_HASH — Telegram linking is off.");
    writeStore({
      status: "error",
      error:
        "Set TELEGRAM_API_ID and TELEGRAM_API_HASH (from my.telegram.org → API development tools) on the server, then reload.",
    });
    return; // stay alive (control loop) so the supervisor doesn't crash-loop
  }

  client = new TelegramClient(new StringSession(loadSession()), apiId, apiHash, {
    connectionRetries: 3,
  });
  client.setLogLevel("error");

  try {
    await client.connect();
    if (await client.checkAuthorization()) {
      await goLive();
      return;
    }
    console.log("[tg] not signed in — starting QR login");
    await qrLogin();
    await goLive();
  } catch (e) {
    const msg = (e && (e.errorMessage || e.message)) || String(e);
    console.error("[tg] failed:", msg);
    if (/AUTH_KEY_DUPLICATED/.test(msg)) {
      writeStore({
        status: "error",
        qr: null,
        error:
          "This Telegram session is already in use by another service. Click re-link to scan a new QR for this dashboard.",
      });
    } else if (/QR_WINDOW_EXPIRED/.test(msg)) {
      writeStore({ status: "idle", qr: null, error: null });
    } else {
      writeStore({ status: "error", qr: null, error: `Telegram: ${msg}. Click re-link to try again.` });
    }
    // Stay idle (control loop keeps running) until the dashboard asks to re-link.
  }
})();
