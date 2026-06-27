// Production process supervisor — runs the Next app + both workers in one
// container (Railway). The web process serves the UI + webhooks; the workers
// sync WhatsApp/Telegram groups to the shared volume. Any crash restarts.

import { spawn } from "node:child_process";

const PORT = process.env.PORT || "3000";

const procs = [
  { name: "web", cmd: "node_modules/.bin/next", args: ["start", "-p", PORT] },
  { name: "whatsapp", cmd: "node", args: ["whatsapp-worker/sync.js"] },
  { name: "telegram", cmd: "node", args: ["telegram-worker/sync.js"] },
];

function start(p, attempt = 0) {
  const child = spawn(p.cmd, p.args, { stdio: "inherit", env: process.env });
  child.on("exit", (code) => {
    // Don't crash-loop hard; back off up to 30s.
    const delay = Math.min(30_000, 3_000 * (attempt + 1));
    console.error(`[boot] ${p.name} exited (code ${code}); restarting in ${delay / 1000}s`);
    setTimeout(() => start(p, p.name === "web" ? 0 : attempt + 1), delay);
  });
  child.on("error", (err) => console.error(`[boot] ${p.name} error:`, err.message));
}

console.log(`[boot] starting web (:${PORT}) + whatsapp + telegram workers`);
for (const p of procs) start(p);
