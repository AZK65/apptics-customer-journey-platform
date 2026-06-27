// One-time Telegram login → mints a DEDICATED session string for the journey
// worker (so it doesn't collide with the apptics-whatsapp service's session).
//
// Run:  pnpm telegram:login
// Enter the phone (+country code), the code Telegram sends, and 2FA password if
// set. Copy the printed TELEGRAM_SESSION into Railway (Variables) + redeploy.

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  console.error("Missing TELEGRAM_API_ID / TELEGRAM_API_HASH (run `pnpm telegram:login`).");
  process.exit(1);
}

const rl = readline.createInterface({ input, output });
const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 3,
});

await client.start({
  phoneNumber: async () =>
    (await rl.question(`Phone [${process.env.TELEGRAM_PHONE || "+..."}]: `)).trim() ||
    process.env.TELEGRAM_PHONE ||
    "",
  password: async () => (await rl.question("2FA password (blank if none): ")).trim(),
  phoneCode: async () => (await rl.question("Code Telegram sent you: ")).trim(),
  onError: (e) => console.error("login error:", e?.message || e),
});

console.log("\n✅ New dedicated TELEGRAM_SESSION (set this on Railway, then redeploy):\n");
console.log(client.session.save());
console.log("");
await client.disconnect();
process.exit(0);
