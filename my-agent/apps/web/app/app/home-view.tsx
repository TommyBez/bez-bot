"use client";

import { ArrowRightIcon, CalendarClockIcon, HashIcon, NetworkIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useAppState } from "@/components/app/app-state";
import { AppHeader, AppPage, buttonPrimary, buttonSecondary, Card } from "@/components/app/page-header";
import { BotAvatar, StatusDot } from "@/components/bez/bot-avatar";
import { timeAgo, usePoll } from "@/lib/client";
import { FEATURED_TEMPLATES } from "@shared/templates";
import type { BotnetExchange, BotnetMessage, InboxItem } from "@shared/store/types";

type ExchangeWithMessages = BotnetExchange & { messages: BotnetMessage[] };

function Onboarding() {
  return (
    <AppPage wide>
      <div className="mx-auto max-w-3xl py-10 text-center">
        <h1 className="text-gradient text-5xl font-medium tracking-tight sm:text-6xl">Meet your first Bot</h1>
        <p className="mt-4 text-[17px] text-neutral-400">
          Pick a job. Your Bot gets its own computer, remembers how you work, and messages teammates when the work needs them.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURED_TEMPLATES.map((t) => (
          <Link
            className="group flex flex-col gap-4 rounded-[20px] border border-white/10 bg-[#0a0a0b] p-5 transition-colors hover:border-white/25"
            href={`/app/bots/new?template=${t.id}`}
            key={t.id}
          >
            <BotAvatar color={t.color} emoji={t.emoji} size="lg" />
            <div>
              <div className="text-[15px] text-white">{t.name}</div>
              <div className="text-[13px] text-neutral-500">{t.job}</div>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-8 flex justify-center">
        <Link className={buttonSecondary} href="/app/bots/new">
          <PlusIcon className="size-4" /> Start from scratch
        </Link>
      </div>
    </AppPage>
  );
}

export function HomeView() {
  const { state } = useAppState();
  const { data: network } = usePoll<{ exchanges: ExchangeWithMessages[] }>("/api/network?limit=6", 5000);
  const { data: inbox } = usePoll<{ items: InboxItem[] }>("/api/inbox", 6000);

  if (state.bots.length === 0) return <Onboarding />;

  const botName = (id: string) => state.bots.find((b) => b.id === id)?.name ?? "A bot";
  const working = state.bots.filter((b) => b.status === "working").length;
  const waiting = state.bots.filter((b) => b.status === "waiting").length;

  return (
    <AppPage wide>
      <AppHeader
        actions={
          <>
            <Link className={buttonSecondary} href="/app/threads/new">
              <HashIcon className="size-4" /> New thread
            </Link>
            <Link className={buttonPrimary} href="/app/bots/new">
              <PlusIcon className="size-4" /> New bot
            </Link>
          </>
        }
        body={`${state.bots.length} bots · ${working} working · ${waiting} need you`}
        title={`Good to see you, ${state.user.name.split(" ")[0]}`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state.bots.map((bot) => (
          <Link
            className="group rounded-[20px] border border-white/10 bg-[#0a0a0b] p-5 transition-colors hover:border-white/25"
            href={`/app/bots/${bot.id}`}
            key={bot.id}
          >
            <div className="mb-5 flex items-center justify-between">
              <BotAvatar color={bot.color} emoji={bot.emoji} size="lg" />
              <span className="flex items-center gap-1.5 text-[12px] text-neutral-400">
                <StatusDot className="size-2 ring-0" status={bot.status} />
                {bot.status === "working" ? bot.statusText ?? "Working" : bot.status === "waiting" ? "Needs you" : bot.status === "error" ? "Error" : "Idle"}
              </span>
            </div>
            <div className="text-[15px] text-white">{bot.name}</div>
            <div className="truncate text-[13px] text-neutral-500">{bot.job}</div>
            <div className="mt-3 text-[12px] text-neutral-600">Active {timeAgo(bot.lastActiveAt ?? bot.createdAt)}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] text-white">
              <NetworkIcon className="size-4 text-neutral-500" /> Bots talking to each other
            </h2>
            <Link className="text-[12.5px] text-neutral-500 hover:text-white" href="/app/network">
              View all
            </Link>
          </div>
          {network?.exchanges.length ? (
            <ul className="space-y-3">
              {network.exchanges.slice(0, 6).map((x) => (
                <li className="flex items-start gap-3" key={x.id}>
                  <div className="flex -space-x-2">
                    {[x.fromBotId, x.toBotId].map((id) => {
                      const b = state.bots.find((bb) => bb.id === id);
                      return <BotAvatar color={b?.color} emoji={b?.emoji} key={id} size="sm" />;
                    })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-neutral-200">
                      {botName(x.fromBotId)} → {botName(x.toBotId)}
                      <span className="ml-2 text-[11.5px] text-neutral-600">{timeAgo(x.updatedAt)}</span>
                    </div>
                    <div className="truncate text-[12.5px] text-neutral-500">{x.subject}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      x.status === "working" ? "bg-emerald-400/10 text-emerald-300" : x.status === "failed" ? "bg-red-400/10 text-red-300" : "bg-white/[0.06] text-neutral-400"
                    }`}
                  >
                    {x.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-neutral-500">
              When a bot hands work to a teammate, the conversation shows up here. Try asking a bot to loop in another one.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] text-white">
              <CalendarClockIcon className="size-4 text-neutral-500" /> Latest from your bots
            </h2>
            <Link className="text-[12.5px] text-neutral-500 hover:text-white" href="/app/inbox">
              Inbox
            </Link>
          </div>
          {inbox?.items.length ? (
            <ul className="space-y-2">
              {inbox.items.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <Link className="flex items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-white/[0.03]" href={item.href ?? "/app/inbox"}>
                    <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${item.read ? "bg-neutral-700" : "bg-white"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-neutral-200">{item.title}</span>
                      {item.body ? <span className="block truncate text-[12px] text-neutral-500">{item.body}</span> : null}
                    </span>
                    <span className="text-[11.5px] text-neutral-600">{timeAgo(item.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-neutral-500">Approvals, finished routines, and memory updates land here.</p>
          )}
        </Card>
      </div>

      {state.conversations.length > 0 ? (
        <Card className="mt-4 p-5">
          <h2 className="mb-3 text-[15px] text-white">Recent tasks</h2>
          <ul className="divide-y divide-white/[0.05]">
            {state.conversations.slice(0, 8).map((c) => {
              const bot = state.bots.find((b) => b.id === c.botId);
              return (
                <li key={c.id}>
                  <Link className="flex items-center gap-3 py-2.5" href={`/app/bots/${c.botId}/c/${c.id}`}>
                    <BotAvatar color={bot?.color} emoji={bot?.emoji} size="xs" />
                    <span className="flex-1 truncate text-[13.5px] text-neutral-200">{c.title}</span>
                    <span className="text-[12px] text-neutral-600">{timeAgo(c.updatedAt)}</span>
                    <ArrowRightIcon className="size-3.5 text-neutral-600" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </AppPage>
  );
}
