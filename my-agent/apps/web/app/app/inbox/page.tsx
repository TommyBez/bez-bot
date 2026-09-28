"use client";

import { AlertTriangleIcon, BellIcon, BrainIcon, CalendarClockIcon, CheckCircle2Icon, HelpCircleIcon, NetworkIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { useAppState } from "@/components/app/app-state";
import { AppHeader, AppPage, buttonSecondary, EmptyState } from "@/components/app/page-header";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api, timeAgo, usePoll } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { InboxItem, InboxKind } from "@shared/store/types";

const ICONS: Record<InboxKind, typeof BellIcon> = {
  approval: ShieldCheckIcon,
  question: HelpCircleIcon,
  done: CheckCircle2Icon,
  memory: BrainIcon,
  botnet: NetworkIcon,
  routine: CalendarClockIcon,
  error: AlertTriangleIcon,
};

export default function InboxPage() {
  const { state, refresh: refreshShell } = useAppState();
  const { data, refresh } = usePoll<{ items: InboxItem[]; unread: number }>("/api/inbox", 4000);
  const items = data?.items ?? [];
  const needsYou = items.filter((i) => (i.kind === "approval" || i.kind === "question") && !i.read);

  async function markRead(ids: string[] | "all") {
    await api("/api/inbox", { method: "POST", json: { ids } });
    await Promise.all([refresh(), refreshShell()]);
  }

  return (
    <AppPage>
      <AppHeader
        actions={
          items.some((i) => !i.read) ? (
            <button className={buttonSecondary} onClick={() => void markRead("all")} type="button">
              Mark all read
            </button>
          ) : null
        }
        body={needsYou.length > 0 ? `${needsYou.length} waiting on your approval or answer` : "Bots come back here when your approval is needed or work is done."}
        title="Inbox"
      />
      {items.length === 0 ? (
        <EmptyState body="Approvals, questions, finished routines, and bot-to-bot replies will show up here." title="All caught up" />
      ) : (
        <ul className="divide-y divide-white/[0.05] rounded-[20px] border border-white/10 bg-[#0a0a0b]">
          {items.map((item) => {
            const Icon = ICONS[item.kind] ?? BellIcon;
            const bot = state.bots.find((b) => b.id === item.botId);
            return (
              <li key={item.id}>
                <Link
                  className={cn("flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.02]", item.read ? "opacity-60" : "")}
                  href={item.href ?? "/app"}
                  onClick={() => void markRead([item.id])}
                >
                  {bot ? <BotAvatar color={bot.color} emoji={bot.emoji} size="sm" /> : <Icon className="mt-1 size-4 text-neutral-500" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon
                        className={cn(
                          "size-3.5 shrink-0",
                          item.kind === "approval" || item.kind === "question" ? "text-amber-300" : item.kind === "error" ? "text-red-400" : "text-neutral-500",
                        )}
                      />
                      <span className="truncate text-[13.5px] text-white">{item.title}</span>
                    </div>
                    {item.body ? <p className="mt-0.5 line-clamp-2 text-[12.5px] text-neutral-500">{item.body}</p> : null}
                  </div>
                  <span className="shrink-0 text-[11.5px] text-neutral-600">{timeAgo(item.createdAt)}</span>
                  {!item.read ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-white" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppPage>
  );
}
