"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Send, CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type ChannelStatus = {
  connected?: boolean;
  status?: string; // starting|qr|password|checking|connected|idle|error|…
  me?: string | null;
  error?: string | null;
  hint?: string | null; // telegram 2FA hint
  qr?: string | null; // data URL
};

type Status = {
  source?: "local" | "sales-bot";
  whatsapp?: ChannelStatus;
  telegram?: ChannelStatus;
  error?: string;
};

function Dot({ on }: { on: boolean }) {
  return (
    <span className="relative flex size-2.5">
      {on && (
        <span
          className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
          style={{ backgroundColor: "var(--stage-won)" }}
        />
      )}
      <span
        className="relative inline-flex size-2.5 rounded-full"
        style={{ backgroundColor: on ? "var(--stage-won)" : "var(--muted-foreground)" }}
      />
    </span>
  );
}

function Panel({
  icon: Icon,
  name,
  color,
  steps,
  connected,
  meLabel,
  qr,
  errorText,
  busy,
  waitingText,
  body,
  children,
}: {
  icon: typeof MessageSquare;
  name: string;
  color: string;
  steps: string;
  connected: boolean;
  meLabel?: string | null;
  qr?: string | null;
  errorText?: string | null;
  busy?: boolean;
  waitingText?: string | null;
  body?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex flex-col items-center space-y-3 text-center">
        <div className="flex w-full items-center justify-between">
          <span
            className="flex size-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
              color,
            }}
          >
            <Icon className="size-5" />
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Dot on={connected} />
            {connected ? "Connected" : "Not linked"}
          </span>
        </div>

        <div className="w-full text-left">
          <span className="font-semibold">{name}</span>
          <p className="mt-0.5 text-xs text-muted-foreground">{steps}</p>
        </div>

        <div className="flex min-h-[248px] w-full items-center justify-center rounded-xl border bg-muted/30 p-3">
          {body ? (
            body
          ) : connected ? (
            <span className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--stage-won)" }}>
              <CheckCircle2 className="size-4" />
              Connected{meLabel ? ` as ${meLabel}` : ""}
            </span>
          ) : qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`${name} QR`} className="size-56 rounded-lg bg-white p-2" />
          ) : busy ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Generating QR…
            </span>
          ) : waitingText ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {waitingText}
            </span>
          ) : errorText ? (
            <span className="max-w-[240px] text-xs" style={{ color: "var(--stage-lost, #ef4444)" }}>
              {errorText}
            </span>
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleDashed className="size-4" /> Idle
            </span>
          )}
        </div>

        <div className="w-full">{children}</div>
      </CardContent>
    </Card>
  );
}

export function SalesAccountsManager() {
  const [s, setS] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [waBusy, setWaBusy] = useState(false);
  const [tgBusy, setTgBusy] = useState(false);
  // Re-linking disconnects a live number, so it takes a deliberate second click.
  const [confirming, setConfirming] = useState<"whatsapp" | "telegram" | null>(null);
  const [tgPassword, setTgPassword] = useState("");
  const [tgPwSending, setTgPwSending] = useState(false);

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/bots/accounts", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) {
        setLoadError(d.error || `status ${r.status}`);
        return;
      }
      setLoadError(null);
      setS(d);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [poll]);

  const act = async (target: "whatsapp" | "telegram") => {
    const setBusy = target === "whatsapp" ? setWaBusy : setTgBusy;
    setBusy(true);
    try {
      await fetch("/api/bots/accounts/relink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      await poll();
    } finally {
      // let the bot spin up a fresh QR before dropping the busy hint
      setTimeout(() => setBusy(false), 4000);
    }
  };

  const submitTgPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgPassword) return;
    setTgPwSending(true);
    try {
      await fetch("/api/bots/accounts/relink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "telegram", action: "password", password: tgPassword }),
      });
      setTgPassword("");
      await poll();
    } finally {
      setTgPwSending(false);
    }
  };

  // Button that guards a live connection behind an explicit confirm step.
  const relinkControl = (
    target: "whatsapp" | "telegram",
    connected: boolean,
    busy: boolean,
  ) => {
    const label = target === "whatsapp" ? "WhatsApp" : "Telegram";
    if (confirming === target) {
      return (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-left">
          <p className="text-xs text-muted-foreground">
            This disconnects the current {label} number <b>immediately</b>. The bot
            can’t create groups or send messages on {label} until you scan the new QR.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(null)}
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setConfirming(null);
                act(target);
              }}
              className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Yes, re-link
            </button>
          </div>
        </div>
      );
    }
    return (
      <button
        onClick={() => (connected ? setConfirming(target) : act(target))}
        disabled={busy}
        className="w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
      >
        {connected ? "Re-link with new number" : busy ? "Starting…" : "Show / refresh QR"}
      </button>
    );
  };

  const wa = s?.whatsapp || {};
  const tg = s?.telegram || {};
  const waConnected = !!wa.connected;
  const tgConnected = !!tg.connected || tg.status === "connected";
  const waiting = (c: ChannelStatus) =>
    c.status === "starting" ? "Starting…" : c.status === "checking" ? "Signing in…" : null;

  const tgPasswordForm =
    tg.status === "password" ? (
      <form onSubmit={submitTgPassword} className="w-full max-w-[260px] space-y-2 text-left">
        <p className="text-sm font-medium">QR scanned — enter your Telegram 2FA password</p>
        {tg.hint && <p className="text-xs text-muted-foreground">Hint: {tg.hint}</p>}
        {tg.error && (
          <p className="text-xs" style={{ color: "var(--stage-lost, #ef4444)" }}>
            {tg.error}
          </p>
        )}
        <input
          type="password"
          autoComplete="current-password"
          value={tgPassword}
          onChange={(e) => setTgPassword(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          placeholder="Cloud password"
          autoFocus
        />
        <button
          type="submit"
          disabled={!tgPassword || tgPwSending}
          className="w-full rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {tgPwSending ? "Sending…" : "Sign in"}
        </button>
      </form>
    ) : null;

  if (loadError) {
    return (
      <Card>
        <CardContent className="space-y-2 py-6 text-sm">
          <p className="font-medium">Can’t load account status.</p>
          <p className="text-muted-foreground">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        icon={MessageSquare}
        name="WhatsApp"
        color="#22c55e"
        steps="WhatsApp → Settings → Linked devices → Link a device"
        connected={waConnected}
        meLabel={wa.me ? `+${wa.me.replace(/^\+/, "")}` : null}
        qr={wa.qr}
        errorText={wa.error}
        waitingText={waiting(wa)}
        busy={waBusy && !wa.qr}
      >
        {relinkControl("whatsapp", waConnected, waBusy)}
      </Panel>

      <Panel
        icon={Send}
        name="Telegram"
        color="#3b82f6"
        steps="Telegram → Settings → Devices → Link Desktop Device"
        connected={tgConnected}
        meLabel={tg.me}
        qr={tg.qr}
        errorText={tg.error}
        waitingText={waiting(tg)}
        body={tgPasswordForm}
        busy={tgBusy && !tg.qr}
      >
        {relinkControl("telegram", tgConnected, tgBusy)}
      </Panel>
    </div>
  );
}
