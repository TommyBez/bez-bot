"use client";

import { GraduationCapIcon, PlusIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app/app-state";
import { BotChat } from "@/components/app/chat/bot-chat";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api, timeAgo } from "@/lib/client";
import { cn } from "@/lib/utils";
import { getTemplate } from "@shared/templates";
import type { Bot, Conversation } from "@shared/store/types";

export function BotWorkspace({
  bot: initialBot,
  conversation,
  autoRecord,
  newKey,
}: {
  readonly bot: Bot;
  readonly conversation?: Conversation;
  readonly autoRecord?: boolean;
  readonly newKey?: string;
}) {
  const router = useRouter();
  const { state, refresh } = useAppState();
  const bot = state.bots.find((b) => b.id === initialBot.id) ?? initialBot;
  const conversations = state.conversations.filter((c) => c.botId === bot.id);
  const starters = getTemplate(bot.templateId)?.starters ?? [
    "Here's what I need you to own this week…",
    "Loop in a teammate and put together a plan.",
  ];

  async function startTeach() {
    const { conversation: created } = await api<{ conversation: Conversation }>("/api/conversations", {
      method: "POST",
      json: { botId: bot.id, mode: "teach" },
    });
    await refresh();
    router.push(`/app/bots/${bot.id}/c/${created.id}?record=1`);
  }

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/[0.06] xl:flex">
        <div className="space-y-3 border-b border-white/[0.06] p-4">
          <div className="flex items-center gap-3">
            <BotAvatar color={bot.color} emoji={bot.emoji} size="lg" status={bot.status} />
            <div className="min-w-0">
              <div className="truncate text-[15px] text-white">{bot.name}</div>
              <div className="line-clamp-2 text-[12px] text-neutral-500">{bot.job}</div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full bg-white text-[12.5px] font-medium text-black hover:bg-neutral-200"
              onClick={() => router.push(`/app/bots/${bot.id}?n=${Date.now()}`)}
              type="button"
            >
              <PlusIcon className="size-3.5" /> New task
            </button>
            <button
              aria-label="Teach a task"
              className="inline-flex size-8 items-center justify-center rounded-full border border-white/15 text-neutral-300 hover:bg-white/[0.06]"
              onClick={() => void startTeach()}
              title="Teach a task"
              type="button"
            >
              <GraduationCapIcon className="size-4" />
            </button>
            <Link
              aria-label="Bot settings"
              className="inline-flex size-8 items-center justify-center rounded-full border border-white/15 text-neutral-300 hover:bg-white/[0.06]"
              href={`/app/bots/${bot.id}/settings`}
            >
              <SettingsIcon className="size-4" />
            </Link>
          </div>
        </div>
        <div className="px-4 pt-4 pb-1 text-[11px] font-medium tracking-wide text-neutral-500 uppercase">Tasks</div>
        <ul className="scrollbar-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                className={cn(
                  "block rounded-xl px-2.5 py-2 transition-colors",
                  c.id === conversation?.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
                )}
                href={`/app/bots/${bot.id}/c/${c.id}`}
              >
                <span className="block truncate text-[13px] text-neutral-200">
                  {c.mode === "teach" ? "🎓 " : ""}
                  {c.title}
                </span>
                <span className="block text-[11px] text-neutral-600">{timeAgo(c.updatedAt)}</span>
              </Link>
            </li>
          ))}
          {conversations.length === 0 ? <li className="px-2.5 py-2 text-[12.5px] text-neutral-600">No tasks yet.</li> : null}
        </ul>
      </aside>
      <div className="min-w-0 flex-1">
        <BotChat
          autoRecord={autoRecord}
          bot={bot}
          conversationId={conversation?.id}
          header={
            <div className="flex items-center gap-2.5">
              <BotAvatar className="xl:hidden" color={bot.color} emoji={bot.emoji} size="sm" status={bot.status} />
              <div className="min-w-0">
                <div className="truncate text-[14px] text-white">{conversation?.title ?? `New task for ${bot.name}`}</div>
                <div className="truncate text-[11.5px] text-neutral-500">
                  {bot.name} · {bot.status === "working" ? bot.statusText ?? "Working" : bot.status === "waiting" ? "Needs you" : "Idle"}
                </div>
              </div>
            </div>
          }
          key={conversation?.id ?? `new-${bot.id}-${newKey ?? ""}`}
          mode={conversation?.mode === "teach" ? "teach" : "dm"}
          sessionId={conversation?.sessionId}
          starters={starters}
        />
      </div>
    </div>
  );
}
