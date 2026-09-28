"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePoll } from "@/lib/client";
import type { Bot, Conversation, Thread, User } from "@shared/store/types";

export interface AppState {
  user: User;
  bots: Bot[];
  threads: Thread[];
  conversations: Conversation[];
  unread: number;
}

interface AppStateContextValue {
  state: AppState;
  refresh: () => Promise<void>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

/** Shell-wide state (bots with live status, threads, unread count), polled every few seconds. */
export function AppStateProvider({ initial, children }: { readonly initial: AppState; readonly children: ReactNode }) {
  const { data, refresh } = usePoll<AppState>("/api/state", 4000, initial);
  return <AppStateContext.Provider value={{ state: data ?? initial, refresh }}>{children}</AppStateContext.Provider>;
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
