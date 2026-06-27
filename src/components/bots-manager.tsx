"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Radar,
  Plus,
  Trash2,
  X,
  Pencil,
  Check,
  UserPlus,
  Search,
  MessageCircle,
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

interface Watcher {
  name: string;
  chatId: string;
  queries: string[];
}

async function fetchWatchers(): Promise<Watcher[]> {
  const res = await fetch("/api/bots/watchers");
  if (!res.ok) throw new Error("Failed to load watchers");
  return res.json();
}

async function saveWatchers(watchers: Watcher[]): Promise<Watcher[]> {
  const res = await fetch("/api/bots/watchers", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(watchers),
  });
  if (!res.ok) throw new Error("Failed to save watchers");
  return res.json();
}

export function BotsManager() {
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editChatId, setEditChatId] = useState("");

  const [addKeywordIdx, setAddKeywordIdx] = useState<number | null>(null);
  const [newKeyword, setNewKeyword] = useState("");

  const [addWatcherOpen, setAddWatcherOpen] = useState(false);
  const [newWatcherName, setNewWatcherName] = useState("");
  const [newWatcherChatId, setNewWatcherChatId] = useState("");

  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchWatchers();
      setWatchers(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = async (next: Watcher[]) => {
    setSaving(true);
    try {
      const saved = await saveWatchers(next);
      setWatchers(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveKeyword = (watcherIdx: number, queryIdx: number) => {
    const next = watchers.map((w, i) =>
      i === watcherIdx
        ? { ...w, queries: w.queries.filter((_, qi) => qi !== queryIdx) }
        : w,
    );
    persist(next);
  };

  const handleAddKeyword = (watcherIdx: number) => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    const next = watchers.map((w, i) =>
      i === watcherIdx ? { ...w, queries: [...w.queries, trimmed] } : w,
    );
    persist(next);
    setNewKeyword("");
  };

  const handleSaveWatcherEdit = (idx: number) => {
    const next = watchers.map((w, i) =>
      i === idx ? { ...w, name: editName.trim(), chatId: editChatId.trim() } : w,
    );
    persist(next);
    setEditingIdx(null);
  };

  const handleAddWatcher = () => {
    const name = newWatcherName.trim();
    if (!name) return;
    const next = [
      ...watchers,
      {
        name,
        chatId: newWatcherChatId.trim() || "REPLACE_WITH_CHAT_ID",
        queries: [],
      },
    ];
    persist(next);
    setAddWatcherOpen(false);
    setNewWatcherName("");
    setNewWatcherChatId("");
  };

  const handleDeleteWatcher = () => {
    if (deleteIdx === null) return;
    const next = watchers.filter((_, i) => i !== deleteIdx);
    persist(next);
    setDeleteIdx(null);
  };

  const activeCount = watchers.filter(
    (w) => w.chatId && w.chatId !== "REPLACE_WITH_CHAT_ID",
  ).length;
  const totalQueries = watchers.reduce((s, w) => s + w.queries.length, 0);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading bot configuration...
      </div>
    );
  }

  if (error && watchers.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>Could not load watchers: {error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bot hero card */}
      <Card>
        <CardContent className="flex items-start gap-5">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: "color-mix(in oklch, var(--primary) 12%, transparent)",
              color: "var(--primary)",
            }}
          >
            <Radar className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">X Social Listening Bot</h2>
              <Badge variant="outline" className="gap-1">
                <Bot className="size-3" />
                Automated
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitors X (Twitter) for high-intent tweets matching each
              watcher&apos;s keywords. Filters through an LLM and delivers
              qualified leads to Telegram every 3 hours.
            </p>
            <div className="mt-3 flex gap-6 text-sm">
              <div>
                <span className="text-2xl font-semibold tracking-tight">
                  {watchers.length}
                </span>
                <span className="ml-1.5 text-muted-foreground">watchers</span>
              </div>
              <div>
                <span className="text-2xl font-semibold tracking-tight">
                  {activeCount}
                </span>
                <span className="ml-1.5 text-muted-foreground">active</span>
              </div>
              <div>
                <span className="text-2xl font-semibold tracking-tight">
                  {totalQueries}
                </span>
                <span className="ml-1.5 text-muted-foreground">keywords</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Watchers */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Watchers</h3>
        <Button size="sm" variant="outline" onClick={() => setAddWatcherOpen(true)}>
          <UserPlus className="size-3.5" />
          Add Watcher
        </Button>
      </div>

      {watchers.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          No watchers configured yet. Add one to get started.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {watchers.map((watcher, idx) => {
            const active =
              watcher.chatId && watcher.chatId !== "REPLACE_WITH_CHAT_ID";
            const isEditing = editingIdx === idx;
            const isAddingKeyword = addKeywordIdx === idx;

            return (
              <Card key={idx}>
                <CardContent className="space-y-4">
                  {/* Watcher header */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs text-muted-foreground">
                              Name
                            </label>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Watcher name"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">
                              Telegram Chat ID
                            </label>
                            <Input
                              value={editChatId}
                              onChange={(e) => setEditChatId(e.target.value)}
                              placeholder="e.g. 1637955920"
                            />
                          </div>
                          <div className="flex gap-1.5">
                            <Button
                              size="xs"
                              onClick={() => handleSaveWatcherEdit(idx)}
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
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{watcher.name}</span>
                            {active ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklch,var(--stage-won,#22c55e)_14%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--stage-won,#22c55e)]">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                Not configured
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MessageCircle className="size-3" />
                            {active
                              ? `Chat ID: ${watcher.chatId}`
                              : "No Telegram chat ID set"}
                          </div>
                        </>
                      )}
                    </div>
                    {!isEditing && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setEditingIdx(idx);
                            setEditName(watcher.name);
                            setEditChatId(
                              watcher.chatId === "REPLACE_WITH_CHAT_ID"
                                ? ""
                                : watcher.chatId,
                            );
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

                  {/* Keywords */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        <Search className="mr-1 inline size-3" />
                        Keywords ({watcher.queries.length})
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setAddKeywordIdx(isAddingKeyword ? null : idx);
                          setNewKeyword("");
                        }}
                      >
                        <Plus className="size-3" />
                        Add
                      </Button>
                    </div>

                    {isAddingKeyword && (
                      <form
                        className="mb-2 flex gap-1.5"
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAddKeyword(idx);
                        }}
                      >
                        <Input
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          placeholder="e.g. Shopify payments disabled"
                          autoFocus
                        />
                        <Button type="submit" size="default" disabled={saving || !newKeyword.trim()}>
                          <Plus className="size-3.5" />
                        </Button>
                      </form>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {watcher.queries.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          No keywords yet — add some to start monitoring.
                        </span>
                      ) : (
                        watcher.queries.map((q, qi) => (
                          <span
                            key={qi}
                            className="group inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-xs"
                          >
                            {q}
                            <button
                              type="button"
                              className="ml-0.5 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                              onClick={() => handleRemoveKeyword(idx, qi)}
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
            );
          })}
        </div>
      )}

      {/* Add watcher dialog */}
      <Dialog open={addWatcherOpen} onOpenChange={setAddWatcherOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Watcher</DialogTitle>
            <DialogDescription>
              Each watcher gets their own keywords, Telegram notifications, and
              feedback loop.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                value={newWatcherName}
                onChange={(e) => setNewWatcherName(e.target.value)}
                placeholder="e.g. Jake"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Telegram Chat ID
              </label>
              <Input
                value={newWatcherChatId}
                onChange={(e) => setNewWatcherChatId(e.target.value)}
                placeholder="Message @userinfobot on Telegram to get this"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Leave blank to configure later.
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleAddWatcher} disabled={!newWatcherName.trim() || saving}>
              <UserPlus className="size-3.5" />
              Add Watcher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteIdx !== null} onOpenChange={() => setDeleteIdx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Watcher</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <strong>{deleteIdx !== null ? watchers[deleteIdx]?.name : ""}</strong>?
              Their keywords and feedback history will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteWatcher} disabled={saving}>
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saving / error indicator */}
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
