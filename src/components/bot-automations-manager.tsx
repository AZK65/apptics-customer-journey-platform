"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, MessageSquare, Clock, Bell, Reply, EyeOff, Moon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Target = "group" | "dm" | "both";

interface Step {
  enabled: boolean;
  target: Target;
  message: string;
  beforeCallMin?: number;
  afterMin?: number;
}
interface AutomationConfig {
  createChat: { enabled: boolean; delayMin: number; message: string };
  reminders: Step[];
  followups: Step[];
  noShow: { enabled: boolean; afterCallMin: number; target: Target; message: string };
  quietHours: { enabled: boolean; start: string; end: string; tz: string };
}

// minutes ↔ {value, unit}
function fromMin(m: number): [number, "min" | "hours" | "days"] {
  m = m || 0;
  if (m >= 1440 && m % 1440 === 0) return [m / 1440, "days"];
  if (m >= 60 && m % 60 === 0) return [m / 60, "hours"];
  return [m, "min"];
}
function toMin(v: number, unit: string): number {
  const f = unit === "days" ? 1440 : unit === "hours" ? 60 : 1;
  return Math.max(0, Math.round((v || 0) * f));
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
      style={{ backgroundColor: on ? "var(--stage-won)" : "var(--muted)" }}
      aria-pressed={on}
    >
      <span
        className="inline-block size-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function TimeInput({
  min,
  onChange,
}: {
  min: number;
  onChange: (min: number) => void;
}) {
  const [val, unit] = fromMin(min);
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        value={val}
        onChange={(e) => onChange(toMin(Number(e.target.value), unit))}
        className="w-16 rounded-md border bg-background px-2 py-1 text-sm"
      />
      <select
        value={unit}
        onChange={(e) => onChange(toMin(val, e.target.value))}
        className="rounded-md border bg-background px-2 py-1 text-sm"
      >
        <option value="min">min</option>
        <option value="hours">hours</option>
        <option value="days">days</option>
      </select>
    </span>
  );
}

function TargetSeg({ value, onChange }: { value: Target; onChange: (t: Target) => void }) {
  const opts: [Target, string][] = [["group", "Group"], ["dm", "DM"], ["both", "Both"]];
  return (
    <span className="inline-flex overflow-hidden rounded-md border text-xs">
      {opts.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={
            "px-2.5 py-1 transition-colors " +
            (v === value ? "bg-foreground text-background" : "hover:bg-muted")
          }
        >
          {l}
        </button>
      ))}
    </span>
  );
}

function Msg({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Message… use {first} for first name, {when} for the call time"
      rows={2}
      className="w-full resize-y rounded-md border bg-background px-2.5 py-2 text-sm"
    />
  );
}

function Section({
  icon: Icon,
  title,
  desc,
  right,
  children,
}: {
  icon: typeof Bell;
  title: string;
  desc: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
              <Icon className="size-4" />
            </span>
            <div>
              <div className="font-semibold">{title}</div>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
          {right}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function BotAutomationsManager() {
  const [cfg, setCfg] = useState<AutomationConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/bots/automations", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || `status ${r.status}`);
        return;
      }
      setError(null);
      setCfg(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patch(update: Partial<AutomationConfig>) {
    setCfg((c) => (c ? { ...c, ...update } : c));
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setStatus("");
    try {
      const r = await fetch("/api/bots/automations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const d = await r.json();
      if (r.ok) {
        setCfg(d.config || cfg);
        setStatus("Saved ✓");
        setTimeout(() => setStatus(""), 2500);
      } else {
        setStatus("Save failed: " + (d.error || r.status));
      }
    } catch {
      setStatus("Save failed (network)");
    } finally {
      setSaving(false);
    }
  }

  if (error && !cfg) {
    return (
      <Card>
        <CardContent className="space-y-1 py-6 text-sm">
          <p className="font-medium">Can’t reach the sales bot.</p>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }
  if (!cfg) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading automations…
      </div>
    );
  }

  const stepList = (
    key: "reminders" | "followups",
    label: string,
    timeLabel: string,
    minField: "beforeCallMin" | "afterMin",
  ) => (
    <div className="space-y-3">
      {cfg[key].map((s, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Toggle
              on={s.enabled}
              onChange={(v) => {
                const arr = [...cfg[key]];
                arr[i] = { ...arr[i], enabled: v };
                patch({ [key]: arr } as Partial<AutomationConfig>);
              }}
            />
            <span className="text-sm font-medium">{label} {i + 1}</span>
            <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <TimeInput
                min={(s[minField] as number) || 0}
                onChange={(m) => {
                  const arr = [...cfg[key]];
                  arr[i] = { ...arr[i], [minField]: m };
                  patch({ [key]: arr } as Partial<AutomationConfig>);
                }}
              />
              {timeLabel}
              <span>send to</span>
              <TargetSeg
                value={s.target}
                onChange={(t) => {
                  const arr = [...cfg[key]];
                  arr[i] = { ...arr[i], target: t };
                  patch({ [key]: arr } as Partial<AutomationConfig>);
                }}
              />
              <button
                onClick={() => patch({ [key]: cfg[key].filter((_, j) => j !== i) } as Partial<AutomationConfig>)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-500"
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          </div>
          <Msg
            value={s.message}
            onChange={(m) => {
              const arr = [...cfg[key]];
              arr[i] = { ...arr[i], message: m };
              patch({ [key]: arr } as Partial<AutomationConfig>);
            }}
          />
        </div>
      ))}
      <button
        onClick={() =>
          patch({
            [key]: [
              ...cfg[key],
              minField === "beforeCallMin"
                ? { enabled: true, beforeCallMin: 60, target: "group", message: "" }
                : { enabled: true, afterMin: 1440, target: "group", message: "" },
            ],
          } as Partial<AutomationConfig>)
        }
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="size-3.5" /> Add {label.toLowerCase()}
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <Section
        icon={MessageSquare}
        title="Create the group chat"
        desc="Make the group + welcome message after a booking."
        right={
          <Toggle
            on={cfg.createChat.enabled}
            onChange={(v) => patch({ createChat: { ...cfg.createChat, enabled: v } })}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>delay</span>
          <TimeInput
            min={cfg.createChat.delayMin}
            onChange={(m) => patch({ createChat: { ...cfg.createChat, delayMin: m } })}
          />
          <span>after booking</span>
        </div>
        <Msg
          value={cfg.createChat.message}
          onChange={(m) => patch({ createChat: { ...cfg.createChat, message: m } })}
        />
      </Section>

      <Section icon={Bell} title="Pre-call reminders" desc="Sent before the scheduled call time.">
        {stepList("reminders", "Reminder", "before call", "beforeCallMin")}
      </Section>

      <Section icon={Reply} title="Follow-ups" desc="Sent after the group is created.">
        {stepList("followups", "Follow-up", "after group made", "afterMin")}
      </Section>

      <Section
        icon={EyeOff}
        title="No-show follow-up"
        desc="Sent if the call time passes."
        right={
          <Toggle
            on={cfg.noShow.enabled}
            onChange={(v) => patch({ noShow: { ...cfg.noShow, enabled: v } })}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>after call time</span>
          <TimeInput
            min={cfg.noShow.afterCallMin}
            onChange={(m) => patch({ noShow: { ...cfg.noShow, afterCallMin: m } })}
          />
          <span>send to</span>
          <TargetSeg value={cfg.noShow.target} onChange={(t) => patch({ noShow: { ...cfg.noShow, target: t } })} />
        </div>
        <Msg value={cfg.noShow.message} onChange={(m) => patch({ noShow: { ...cfg.noShow, message: m } })} />
      </Section>

      <Section
        icon={Moon}
        title="Quiet hours"
        desc="Hold messages during these hours; they send when the window ends."
        right={
          <Toggle
            on={cfg.quietHours.enabled}
            onChange={(v) => patch({ quietHours: { ...cfg.quietHours, enabled: v } })}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>from</span>
          <input
            type="time"
            value={cfg.quietHours.start}
            onChange={(e) => patch({ quietHours: { ...cfg.quietHours, start: e.target.value } })}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          />
          <span>to</span>
          <input
            type="time"
            value={cfg.quietHours.end}
            onChange={(e) => patch({ quietHours: { ...cfg.quietHours, end: e.target.value } })}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          />
          <span>timezone</span>
          <input
            value={cfg.quietHours.tz}
            onChange={(e) => patch({ quietHours: { ...cfg.quietHours, tz: e.target.value } })}
            className="w-44 rounded-md border bg-background px-2 py-1 text-sm"
          />
        </div>
      </Section>

      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-xl border bg-card/90 p-3 backdrop-blur">
        <span className="text-sm text-muted-foreground">{status}</span>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save automations
        </button>
      </div>
    </div>
  );
}
