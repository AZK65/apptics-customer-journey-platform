"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem, fadeIn } from "@/lib/motion";
import {
  Bot,
  Plus,
  Trash2,
  X,
  Pencil,
  Check,
  Search,
  Globe,
  Hash,
  LogIn,
  Shield,
  Power,
  PowerOff,
  RefreshCw,
  ArrowUp,
  MessageSquare,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface RedditSource {
  subreddit: string;
  queries: string[];
}

interface RedditAccount {
  username: string;
  password: string;
  proxy: string;
  active: boolean;
  postKarma?: number;
  commentKarma?: number;
  totalKarma?: number;
  accountAge?: string;
  health?: "healthy" | "warning" | "suspended" | "new";
  lastChecked?: string;
}

interface HealthData {
  postKarma: number;
  commentKarma: number;
  totalKarma: number;
  accountAge: string;
  health: "healthy" | "warning" | "suspended" | "new";
}

interface Sources {
  globalQueries: string[];
  redditSources: RedditSource[];
  shopifyCommunityQueries: string[];
  accounts: RedditAccount[];
}

const EMPTY: Sources = {
  globalQueries: [],
  redditSources: [],
  shopifyCommunityQueries: [],
  accounts: [],
};

async function fetchSources(): Promise<Sources> {
  const res = await fetch("/api/bots/reddit-sources");
  if (!res.ok) throw new Error("Failed to load sources");
  return res.json();
}

async function saveSources(sources: Sources): Promise<Sources> {
  const res = await fetch("/api/bots/reddit-sources", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sources),
  });
  if (!res.ok) throw new Error("Failed to save sources");
  return res.json();
}

export function RedditBotsManager() {
  const [sources, setSources] = useState<Sources>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subreddit editing
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editSubreddit, setEditSubreddit] = useState("");

  // Add keyword to subreddit
  const [addKeywordIdx, setAddKeywordIdx] = useState<number | null>(null);
  const [newKeyword, setNewKeyword] = useState("");

  // Add subreddit dialog
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [newSubreddit, setNewSubreddit] = useState("");

  // Delete subreddit confirmation
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  // Global / Shopify Community keyword input
  const [addingGlobal, setAddingGlobal] = useState(false);
  const [newGlobal, setNewGlobal] = useState("");
  const [addingShopify, setAddingShopify] = useState(false);
  const [newShopify, setNewShopify] = useState("");

  // Account dialog
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [acctUsername, setAcctUsername] = useState("");
  const [acctPassword, setAcctPassword] = useState("");
  const [acctProxy, setAcctProxy] = useState("");
  const [deleteAcctIdx, setDeleteAcctIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSources();
      setSources(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persist = async (next: Sources) => {
    setSaving(true);
    try {
      const saved = await saveSources(next);
      setSources(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Health check ──

  const [checkingHealth, setCheckingHealth] = useState<Set<number>>(new Set());

  const handleCheckHealth = async (idx: number) => {
    setCheckingHealth((prev) => new Set(prev).add(idx));
    try {
      const acct = sources.accounts[idx];
      const res = await fetch(
        `/api/bots/reddit-health?username=${encodeURIComponent(acct.username)}`,
      );
      if (!res.ok) throw new Error("Health check failed");
      const data: HealthData = await res.json();
      const next = sources.accounts.map((a, i) =>
        i === idx
          ? {
              ...a,
              postKarma: data.postKarma,
              commentKarma: data.commentKarma,
              totalKarma: data.totalKarma,
              accountAge: data.accountAge,
              health: data.health,
              lastChecked: new Date().toISOString(),
            }
          : a,
      );
      persist({ ...sources, accounts: next });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCheckingHealth((prev) => {
        const s = new Set(prev);
        s.delete(idx);
        return s;
      });
    }
  };

  const handleCheckAllHealth = async () => {
    for (let i = 0; i < sources.accounts.length; i++) {
      await handleCheckHealth(i);
    }
  };

  // ── Subreddit CRUD ──

  const handleAddSubreddit = () => {
    const sub = newSubreddit.trim().replace(/^r\//, "");
    if (!sub) return;
    persist({
      ...sources,
      redditSources: [
        ...sources.redditSources,
        { subreddit: sub, queries: [] },
      ],
    });
    setAddSubOpen(false);
    setNewSubreddit("");
  };

  const handleRenameSubreddit = (idx: number) => {
    const sub = editSubreddit.trim().replace(/^r\//, "");
    if (!sub) return;
    const next = sources.redditSources.map((s, i) =>
      i === idx ? { ...s, subreddit: sub } : s,
    );
    persist({ ...sources, redditSources: next });
    setEditingIdx(null);
  };

  const handleDeleteSubreddit = () => {
    if (deleteIdx === null) return;
    persist({
      ...sources,
      redditSources: sources.redditSources.filter((_, i) => i !== deleteIdx),
    });
    setDeleteIdx(null);
  };

  // ── Per-subreddit keyword CRUD ──

  const handleAddSubKeyword = (idx: number) => {
    const kw = newKeyword.trim();
    if (!kw) return;
    const next = sources.redditSources.map((s, i) =>
      i === idx ? { ...s, queries: [...s.queries, kw] } : s,
    );
    persist({ ...sources, redditSources: next });
    setNewKeyword("");
  };

  const handleRemoveSubKeyword = (subIdx: number, qIdx: number) => {
    const next = sources.redditSources.map((s, i) =>
      i === subIdx
        ? { ...s, queries: s.queries.filter((_, qi) => qi !== qIdx) }
        : s,
    );
    persist({ ...sources, redditSources: next });
  };

  // ── Global queries CRUD ──

  const handleAddGlobal = () => {
    const kw = newGlobal.trim();
    if (!kw) return;
    persist({ ...sources, globalQueries: [...sources.globalQueries, kw] });
    setNewGlobal("");
  };

  const handleRemoveGlobal = (idx: number) => {
    persist({
      ...sources,
      globalQueries: sources.globalQueries.filter((_, i) => i !== idx),
    });
  };

  // ── Shopify Community queries CRUD ──

  const handleAddShopify = () => {
    const kw = newShopify.trim();
    if (!kw) return;
    persist({
      ...sources,
      shopifyCommunityQueries: [...sources.shopifyCommunityQueries, kw],
    });
    setNewShopify("");
  };

  const handleRemoveShopify = (idx: number) => {
    persist({
      ...sources,
      shopifyCommunityQueries: sources.shopifyCommunityQueries.filter(
        (_, i) => i !== idx,
      ),
    });
  };

  // ── Account CRUD ──

  const handleAddAccount = () => {
    if (!acctUsername.trim()) return;
    persist({
      ...sources,
      accounts: [
        ...sources.accounts,
        {
          username: acctUsername.trim(),
          password: acctPassword.trim(),
          proxy: acctProxy.trim(),
          active: true,
        },
      ],
    });
    setAddAccountOpen(false);
    setAcctUsername("");
    setAcctPassword("");
    setAcctProxy("");
  };

  const handleToggleAccount = (idx: number) => {
    const next = sources.accounts.map((a, i) =>
      i === idx ? { ...a, active: !a.active } : a,
    );
    persist({ ...sources, accounts: next });
  };

  const handleDeleteAccount = () => {
    if (deleteAcctIdx === null) return;
    persist({
      ...sources,
      accounts: sources.accounts.filter((_, i) => i !== deleteAcctIdx),
    });
    setDeleteAcctIdx(null);
  };

  // ── Stats ──

  const totalKeywords = sources.redditSources.reduce(
    (s, r) => s + r.queries.length,
    0,
  );
  const activeAccounts = sources.accounts.filter((a) => a.active).length;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading bot configuration...
      </div>
    );
  }

  if (error && sources.redditSources.length === 0 && sources.accounts.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>Could not load sources: {error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <motion.div
        {...fadeIn}
        className="flex flex-wrap divide-x divide-y overflow-hidden rounded-xl border bg-card sm:divide-y-0"
      >
        <div className="min-w-[7.5rem] flex-1 px-5 py-4">
          <div className="text-sm text-muted-foreground">Accounts</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight">
            {activeAccounts}
            <span className="text-base font-normal text-muted-foreground">
              /{sources.accounts.length}
            </span>
          </div>
        </div>
        <div className="min-w-[7.5rem] flex-1 px-5 py-4">
          <div className="text-sm text-muted-foreground">Subreddits</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight">
            {sources.redditSources.length}
          </div>
        </div>
        <div className="min-w-[7.5rem] flex-1 px-5 py-4">
          <div className="text-sm text-muted-foreground">Keywords</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight">
            {totalKeywords}
          </div>
        </div>
        <div className="min-w-[7.5rem] flex-1 px-5 py-4">
          <div className="text-sm text-muted-foreground">
            Shopify Community
          </div>
          <div className="mt-1 text-3xl font-semibold tracking-tight">
            {sources.shopifyCommunityQueries.length}
          </div>
        </div>
      </motion.div>

      {/* ── Accounts ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Signed-in Accounts
          </h3>
          <Badge variant="secondary" className="text-[10px]">
            Comofaux Headless Browser
          </Badge>
        </div>
        <div className="flex gap-2">
          {sources.accounts.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCheckAllHealth}
              disabled={checkingHealth.size > 0}
            >
              <RefreshCw className={`size-3.5 ${checkingHealth.size > 0 ? "animate-spin" : ""}`} />
              Check All
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddAccountOpen(true)}
          >
            <LogIn className="size-3.5" />
            Sign In
          </Button>
        </div>
      </div>

      {sources.accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No Reddit accounts signed in. Each account signs in via Comofaux
          with its own dedicated residential proxy.
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {sources.accounts.map((acct, idx) => {
            const healthColor =
              acct.health === "healthy"
                ? "var(--stage-won, #22c55e)"
                : acct.health === "warning"
                  ? "#f59e0b"
                  : acct.health === "suspended"
                    ? "#ef4444"
                    : acct.health === "new"
                      ? "#3b82f6"
                      : "var(--muted-foreground)";
            const healthLabel =
              acct.health === "healthy"
                ? "Healthy"
                : acct.health === "warning"
                  ? "Warning"
                  : acct.health === "suspended"
                    ? "Suspended"
                    : acct.health === "new"
                      ? "New"
                      : "Unknown";

            return (
              <motion.div key={idx} variants={staggerItem}>
                <Card>
                  <CardContent className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            backgroundColor: `color-mix(in oklch, ${healthColor} 14%, transparent)`,
                            color: healthColor,
                          }}
                        >
                          <LogIn className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold">
                              u/{acct.username}
                            </span>
                            {acct.health && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                style={{
                                  backgroundColor: `color-mix(in oklch, ${healthColor} 14%, transparent)`,
                                  color: healthColor,
                                }}
                              >
                                {healthLabel}
                              </span>
                            )}
                            {!acct.active && (
                              <Badge
                                variant="secondary"
                                className="shrink-0 text-[10px]"
                              >
                                Off
                              </Badge>
                            )}
                          </div>
                          {acct.accountAge && (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="size-3" />
                              {acct.accountAge} old
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleCheckHealth(idx)}
                          disabled={checkingHealth.has(idx)}
                          title="Check health"
                        >
                          <RefreshCw
                            className={`size-3 ${checkingHealth.has(idx) ? "animate-spin" : ""}`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleToggleAccount(idx)}
                          title={acct.active ? "Disable" : "Enable"}
                        >
                          {acct.active ? (
                            <Power className="size-3" />
                          ) : (
                            <PowerOff className="size-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive"
                          onClick={() => setDeleteAcctIdx(idx)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Karma stats */}
                    {acct.totalKarma != null && (
                      <div className="flex gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <ArrowUp className="size-3 text-muted-foreground" />
                          <span className="font-semibold">
                            {(acct.totalKarma ?? 0).toLocaleString()}
                          </span>
                          <span className="text-muted-foreground">karma</span>
                        </div>
                        <div className="text-muted-foreground">
                          {(acct.postKarma ?? 0).toLocaleString()} post ·{" "}
                          {(acct.commentKarma ?? 0).toLocaleString()} comment
                        </div>
                      </div>
                    )}

                    {/* Proxy */}
                    {acct.proxy && (
                      <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1.5">
                        <Shield className="size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate text-xs font-mono text-muted-foreground">
                          {acct.proxy.replace(
                            /:\/\/([^:]+):([^@]+)@/,
                            "://***:***@",
                          )}
                        </span>
                      </div>
                    )}

                    {/* Last checked */}
                    {acct.lastChecked && (
                      <div className="text-[10px] text-muted-foreground">
                        Checked{" "}
                        {new Date(acct.lastChecked).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* ── Global queries ── */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-muted-foreground" />
              <span className="font-semibold">Global Queries</span>
              <Badge variant="secondary" className="text-xs">
                Searched in every subreddit
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setAddingGlobal(!addingGlobal);
                setNewGlobal("");
              }}
            >
              <Plus className="size-3" />
              Add
            </Button>
          </div>
          {addingGlobal && (
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                handleAddGlobal();
              }}
            >
              <Input
                value={newGlobal}
                onChange={(e) => setNewGlobal(e.target.value)}
                placeholder="e.g. Apptics"
                autoFocus
              />
              <Button
                type="submit"
                size="default"
                disabled={saving || !newGlobal.trim()}
              >
                <Plus className="size-3.5" />
              </Button>
            </form>
          )}
          <div className="flex flex-wrap gap-1.5">
            {sources.globalQueries.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                No global queries configured.
              </span>
            ) : (
              sources.globalQueries.map((q, i) => (
                <span
                  key={i}
                  className="group inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-xs"
                >
                  {q}
                  <button
                    type="button"
                    className="ml-0.5 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    onClick={() => handleRemoveGlobal(i)}
                    disabled={saving}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Subreddits ── */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Subreddits
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAddSubOpen(true)}
        >
          <Plus className="size-3.5" />
          Add Subreddit
        </Button>
      </div>

      {sources.redditSources.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          No subreddits configured yet. Add one to start monitoring.
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-4 lg:grid-cols-2"
        >
          {sources.redditSources.map((source, idx) => {
            const isEditing = editingIdx === idx;
            const isAddingKw = addKeywordIdx === idx;

            return (
              <motion.div key={idx} variants={staggerItem}>
                <Card>
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={editSubreddit}
                              onChange={(e) => setEditSubreddit(e.target.value)}
                              placeholder="subreddit name"
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <Button
                                size="xs"
                                onClick={() => handleRenameSubreddit(idx)}
                                disabled={saving}
                              >
                                <Check className="size-3" />
                                Save
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setEditingIdx(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Hash className="size-3.5 text-muted-foreground" />
                            <span className="font-semibold">
                              r/{source.subreddit}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {source.queries.length} keywords
                            </Badge>
                          </div>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => {
                              setEditingIdx(idx);
                              setEditSubreddit(source.subreddit);
                            }}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-destructive"
                            onClick={() => setDeleteIdx(idx)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          <Search className="mr-1 inline size-3" />
                          Keywords
                        </span>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setAddKeywordIdx(isAddingKw ? null : idx);
                            setNewKeyword("");
                          }}
                        >
                          <Plus className="size-3" />
                          Add
                        </Button>
                      </div>

                      {isAddingKw && (
                        <form
                          className="mb-2 flex gap-1.5"
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleAddSubKeyword(idx);
                          }}
                        >
                          <Input
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            placeholder="e.g. payment processor"
                            autoFocus
                          />
                          <Button
                            type="submit"
                            size="default"
                            disabled={saving || !newKeyword.trim()}
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </form>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {source.queries.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            No keywords yet.
                          </span>
                        ) : (
                          source.queries.map((q, qi) => (
                            <span
                              key={qi}
                              className="group inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-xs"
                            >
                              {q}
                              <button
                                type="button"
                                className="ml-0.5 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                                onClick={() => handleRemoveSubKeyword(idx, qi)}
                                disabled={saving}
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* ── Shopify Community ── */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-muted-foreground" />
              <span className="font-semibold">Shopify Community</span>
              <Badge variant="secondary" className="text-xs">
                community.shopify.com
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setAddingShopify(!addingShopify);
                setNewShopify("");
              }}
            >
              <Plus className="size-3" />
              Add
            </Button>
          </div>
          {addingShopify && (
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                handleAddShopify();
              }}
            >
              <Input
                value={newShopify}
                onChange={(e) => setNewShopify(e.target.value)}
                placeholder="e.g. payments disabled"
                autoFocus
              />
              <Button
                type="submit"
                size="default"
                disabled={saving || !newShopify.trim()}
              >
                <Plus className="size-3.5" />
              </Button>
            </form>
          )}
          <div className="flex flex-wrap gap-1.5">
            {sources.shopifyCommunityQueries.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                No Shopify Community queries configured.
              </span>
            ) : (
              sources.shopifyCommunityQueries.map((q, i) => (
                <span
                  key={i}
                  className="group inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-xs"
                >
                  {q}
                  <button
                    type="button"
                    className="ml-0.5 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    onClick={() => handleRemoveShopify(i)}
                    disabled={saving}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══ Dialogs ═══ */}

      {/* Add subreddit */}
      <Dialog open={addSubOpen} onOpenChange={setAddSubOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Subreddit</DialogTitle>
            <DialogDescription>
              Enter the subreddit name (without the r/ prefix). You can add
              keywords after creating it.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Subreddit
            </label>
            <Input
              value={newSubreddit}
              onChange={(e) => setNewSubreddit(e.target.value)}
              placeholder="e.g. shopify"
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleAddSubreddit}
              disabled={!newSubreddit.trim() || saving}
            >
              <Plus className="size-3.5" />
              Add Subreddit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete subreddit */}
      <Dialog open={deleteIdx !== null} onOpenChange={() => setDeleteIdx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Subreddit</DialogTitle>
            <DialogDescription>
              Remove{" "}
              <strong>
                r/
                {deleteIdx !== null
                  ? sources.redditSources[deleteIdx]?.subreddit
                  : ""}
              </strong>{" "}
              and all its keywords?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteSubreddit}
              disabled={saving}
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign in — Reddit account */}
      <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in to Reddit</DialogTitle>
            <DialogDescription>
              Signs in via Comofaux headless browser. Assign a dedicated
              residential proxy per account to avoid bans.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Username
              </label>
              <Input
                value={acctUsername}
                onChange={(e) => setAcctUsername(e.target.value)}
                placeholder="reddit_username"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Password
              </label>
              <Input
                type="password"
                value={acctPassword}
                onChange={(e) => setAcctPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Residential Proxy
              </label>
              <Input
                value={acctProxy}
                onChange={(e) => setAcctProxy(e.target.value)}
                placeholder="Dedicated residential proxy for this account"
                className="font-mono text-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Each account should have its own proxy — don&apos;t reuse across
                accounts.
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleAddAccount}
              disabled={!acctUsername.trim() || saving}
            >
              <LogIn className="size-3.5" />
              Sign In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete account */}
      <Dialog
        open={deleteAcctIdx !== null}
        onOpenChange={() => setDeleteAcctIdx(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Account</DialogTitle>
            <DialogDescription>
              Sign out{" "}
              <strong>
                u/
                {deleteAcctIdx !== null
                  ? sources.accounts[deleteAcctIdx]?.username
                  : ""}
              </strong>
              ? The bot will no longer use this account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={saving}
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {saving && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-lg">
          Saving...
        </div>
      )}
      {error && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs text-destructive shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
