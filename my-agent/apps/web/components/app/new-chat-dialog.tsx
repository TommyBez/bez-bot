"use client";

import { CheckIcon, Loader2Icon, PlusIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppState } from "@/components/app/app-state";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Bot, Group } from "@shared/store/types";
import { FEATURED_TEMPLATES } from "@shared/templates";

const MIN = 2;
const MAX = 6;

/**
 * "New chat" (⌘N): create a Bot, or pick two to six Bots for a group chat.
 * Existing Bots never get a second chat; they each keep one conversation.
 */
export function NewChatDialog({ open, onOpenChange }: { readonly open: boolean; readonly onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { state, refresh } = useAppState();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected([]);
      setError(undefined);
    }
  }, [open]);

  const bots = state.bots.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()));
  const suggestions = FEATURED_TEMPLATES.filter((t) => !state.bots.some((b) => b.templateId === t.id)).slice(0, 4);

  async function createBot(input: { name?: string; templateId?: string }, key: string) {
    setBusy(key);
    setError(undefined);
    try {
      const { bot } = await api<{ bot: Bot }>("/api/bots", { method: "POST", json: input });
      await refresh();
      onOpenChange(false);
      router.push(input.templateId ? `/app/bots/${bot.id}` : `/app/bots/${bot.id}?details=settings`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the Bot.");
    } finally {
      setBusy(undefined);
    }
  }

  async function createGroup() {
    setBusy("group");
    setError(undefined);
    try {
      const { group } = await api<{ group: Group }>("/api/groups", { method: "POST", json: { memberBotIds: selected } });
      await refresh();
      onOpenChange(false);
      router.push(`/app/groups/${group.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the group.");
    } finally {
      setBusy(undefined);
    }
  }

  const row = "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-50";
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl border-white/10 bg-[#0c0c0e] p-0 text-white" showCloseButton={false}>
        <div className="border-b border-white/[0.07] p-3">
          <DialogTitle className="px-1 pb-2 text-[14px] font-medium">New chat</DialogTitle>
          <DialogDescription className="sr-only">Create a Bot or choose two to six Bots for a group chat.</DialogDescription>
          <input
            autoFocus
            className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[14px] outline-none placeholder:text-neutral-600 focus:border-white/25"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim() && bots.length === 0) void createBot({ name: query.trim() }, "named");
            }}
            placeholder="Type a name, or pick Bots for a group"
            value={query}
          />
        </div>
        <div className="scrollbar-thin max-h-[60vh] overflow-y-auto p-2">
          <button className={row} disabled={!!busy} onClick={() => void createBot(query.trim() ? { name: query.trim() } : {}, "named")} type="button">
            <span className="flex size-8 items-center justify-center rounded-xl border border-dashed border-white/20">
              {busy === "named" ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4 text-neutral-300" />}
            </span>
            <span className="text-[13.5px]">{query.trim() ? `Create “${query.trim()}” Bot` : "Create new Bot"}</span>
          </button>

          {suggestions.length > 0 && !query.trim() ? (
            <>
              <div className="px-2.5 pt-3 pb-1 text-[11px] tracking-wide text-neutral-500 uppercase">Meet a future teammate</div>
              {suggestions.map((t) => (
                <button className={row} disabled={!!busy} key={t.id} onClick={() => void createBot({ templateId: t.id }, t.id)} type="button">
                  <BotAvatar color={t.color} emoji={t.emoji} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px]">{t.name}</span>
                    <span className="block truncate text-[12px] text-neutral-500">{t.job}</span>
                  </span>
                  {busy === t.id ? <Loader2Icon className="size-4 animate-spin text-neutral-400" /> : null}
                </button>
              ))}
            </>
          ) : null}

          {bots.length > 0 ? (
            <>
              <div className="px-2.5 pt-3 pb-1 text-[11px] tracking-wide text-neutral-500 uppercase">Group chat · pick {MIN}–{MAX} Bots</div>
              {bots.map((b) => {
                const on = selected.includes(b.id);
                return (
                  <button
                    className={row}
                    disabled={!on && selected.length >= MAX}
                    key={b.id}
                    onClick={() => setSelected((s) => (on ? s.filter((id) => id !== b.id) : [...s, b.id]))}
                    type="button"
                  >
                    <BotAvatar color={b.color} emoji={b.emoji} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px]">{b.name}</span>
                      {b.label ? <span className="block truncate text-[12px] text-neutral-500">{b.label}</span> : null}
                    </span>
                    <span className={cn("flex size-5 items-center justify-center rounded-md border", on ? "border-white bg-white text-black" : "border-white/20")}>
                      {on ? <CheckIcon className="size-3.5" /> : null}
                    </span>
                  </button>
                );
              })}
            </>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] p-3">
          <span className="text-[12px] text-red-400">{error}</span>
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-medium text-black disabled:opacity-40"
            disabled={selected.length < MIN || !!busy}
            onClick={() => void createGroup()}
            type="button"
          >
            {busy === "group" ? <Loader2Icon className="size-3.5 animate-spin" /> : <UsersIcon className="size-3.5" />}
            Create group chat{selected.length > 0 ? ` (${selected.length})` : ""}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
