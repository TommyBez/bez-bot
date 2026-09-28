"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { usePoll } from "@/lib/client";
import type { Bot, Group, User } from "@shared/store/types";

export interface AppState {
  user: User;
  bots: Bot[];
  groups: Group[];
}

interface AppStateContextValue {
  state: AppState;
  refresh: () => Promise<void>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

function focused(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

/**
 * OS notifications when a Bot finishes or needs input, for Bots with
 * Notifications on. Suppressed while the app is focused; the sidebar and the
 * tab title still show unread activity.
 */
function useNotifications(bots: Bot[]) {
  const previous = useRef<Map<string, Bot> | null>(null);

  useEffect(() => {
    const ask = () => {
      if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
    };
    window.addEventListener("pointerdown", ask, { once: true });
    return () => window.removeEventListener("pointerdown", ask);
  }, []);

  useEffect(() => {
    const before = previous.current;
    previous.current = new Map(bots.map((b) => [b.id, b]));
    if (!before || !("Notification" in window) || Notification.permission !== "granted" || focused()) return;
    for (const bot of bots) {
      const old = before.get(bot.id);
      if (!old || !bot.notifications || bot.hidden) continue;
      const needsYou = bot.status === "attention" && old.status !== "attention";
      const finished = bot.unread && bot.lastMessageAt !== old.lastMessageAt;
      if (!needsYou && !finished) continue;
      const note = new Notification(bot.name, {
        body: needsYou ? (bot.statusText ?? "Needs your input") : (bot.lastPreview ?? "New activity"),
        tag: bot.id,
      });
      note.onclick = () => {
        window.focus();
        window.location.assign(`/app/bots/${bot.id}`);
      };
    }
  }, [bots]);
}

/** Sidebar state (Bots and groups with live status), polled every few seconds. */
export function AppStateProvider({ initial, children }: { readonly initial: AppState; readonly children: ReactNode }) {
  const { data, refresh } = usePoll<AppState>("/api/state", 3000, initial);
  const state = data ?? initial;
  useNotifications(state.bots);

  const unread = state.bots.filter((b) => !b.hidden && (b.unread || b.status === "attention")).length + state.groups.filter((g) => g.unread).length;
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Bez Bot` : "Bez Bot";
  }, [unread]);

  return <AppStateContext.Provider value={{ state, refresh }}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState must be used inside AppStateProvider");
  return value;
}

export function useBot(botId: string | undefined): Bot | undefined {
  const { state } = useAppState();
  return botId ? state.bots.find((b) => b.id === botId) : undefined;
}
