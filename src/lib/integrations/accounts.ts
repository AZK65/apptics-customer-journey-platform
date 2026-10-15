import nodeFs from "node:fs";
import nodePath from "node:path";
import QRCode from "qrcode";
import { integrationConfig } from "./config";

// ─────────────────────────────────────────────────────────────────────────────
// Sales-bot account linking (WhatsApp + Telegram).
//
// If an external sales bot is configured (SALES_BOT_URL + SALES_BOT_API_KEY) we
// proxy to it. Otherwise we drive the workers that run in this same container:
// they publish their status + raw QR payload in their store.json, and pick up
// commands from a `<channel>-control.json` file written next to that store.
// ─────────────────────────────────────────────────────────────────────────────

export type Channel = "whatsapp" | "telegram";

export interface ChannelStatus {
  connected: boolean;
  status: string; // starting | qr | password | connected | disconnected | error | …
  me: string | null;
  error: string | null;
  hint: string | null; // telegram 2FA password hint
  qr: string | null; // data URL
}

export interface AccountsStatus {
  source: "local" | "sales-bot";
  whatsapp: ChannelStatus;
  telegram: ChannelStatus;
}

interface WorkerStore {
  status?: string;
  qr?: string | null;
  me?: string | null;
  error?: string | null;
  hint?: string | null;
}

function dataPath(channel: Channel) {
  return integrationConfig[channel].dataPath;
}

function controlPath(channel: Channel) {
  return nodePath.join(nodePath.dirname(dataPath(channel)), `${channel}-control.json`);
}

function readStore(channel: Channel): WorkerStore | null {
  try {
    return JSON.parse(nodeFs.readFileSync(dataPath(channel), "utf8"));
  } catch {
    return null;
  }
}

async function localChannel(channel: Channel): Promise<ChannelStatus> {
  const s = readStore(channel);
  if (!s) {
    return {
      connected: false,
      status: "offline",
      me: null,
      error: "Worker hasn't started yet — give it a few seconds.",
      hint: null,
      qr: null,
    };
  }
  const status = s.status || "unknown";
  const showQr = status === "qr" && !!s.qr;
  return {
    connected: status === "connected",
    status,
    me: s.me ?? null,
    error: s.error ?? null,
    hint: s.hint ?? null,
    qr: showQr ? await QRCode.toDataURL(s.qr!, { margin: 1, width: 320 }) : null,
  };
}

/** Tell a local worker to do something (re-link, submit a 2FA password). */
export function sendLocalCommand(
  channel: Channel,
  cmd: { action: "relink" } | { action: "password"; password: string },
) {
  const file = controlPath(channel);
  nodeFs.mkdirSync(nodePath.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  nodeFs.writeFileSync(tmp, JSON.stringify({ ...cmd, at: new Date().toISOString() }));
  nodeFs.renameSync(tmp, file);
}

async function salesBotStatus(): Promise<AccountsStatus> {
  const { url, apiKey } = integrationConfig.salesBot;
  const res = await fetch(`${url}/login/status`, {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`sales bot returned ${res.status}`);
  const d = await res.json();
  const norm = (c: Partial<ChannelStatus> | undefined, connected: boolean): ChannelStatus => ({
    connected,
    status: c?.status || (connected ? "connected" : "idle"),
    me: c?.me ?? null,
    error: c?.error ?? null,
    hint: null,
    qr: c?.qr ?? null,
  });
  return {
    source: "sales-bot",
    whatsapp: norm(d.whatsapp, !!d.whatsapp?.connected),
    telegram: norm(d.telegram, d.telegram?.status === "connected"),
  };
}

export async function accountsStatus(): Promise<AccountsStatus> {
  if (integrationConfig.salesBot.enabled) return salesBotStatus();
  const [whatsapp, telegram] = await Promise.all([
    localChannel("whatsapp"),
    localChannel("telegram"),
  ]);
  return { source: "local", whatsapp, telegram };
}
