"use client";

import { ArrowRightIcon, NetworkIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useAppState } from "@/components/app/app-state";
import type { ExchangeView } from "@/components/app/chat/bot-message";
import { SessionTranscript } from "@/components/app/chat/session-transcript";
import { MessageResponse } from "@/components/ai-elements/message";
import { AppHeader, AppPage, buttonSecondary, Card, EmptyState } from "@/components/app/page-header";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { timeAgo, usePoll } from "@/lib/client";
import { cn } from "@/lib/utils";
import { stripTeammateEnvelope } from "@shared/protocol";

function NetworkView() {
  const params = useSearchParams();
  const { state } = useAppState();
  const { data } = usePoll<{ exchanges: ExchangeView[] }>("/api/network?limit=100", 3000);
  const [filter, setFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("exchange"));
  const [showWork, setShowWork] = useState(false);
  const exchanges = useMemo(
    () => (data?.exchanges ?? []).filter((x) => filter === "all" || x.fromBotId === filter || x.toBotId === filter),
    [data, filter],
  );
  const selected = exchanges.find((x) => x.id === selectedId) ?? exchanges[0];
  useEffect(() => setShowWork(false), [selected?.id]);
  const bot = (id: string) => state.bots.find((b) => b.id === id);
  const active = (data?.exchanges ?? []).filter((x) => x.status === "working").length;

  return (
    <AppPage wide>
      <AppHeader
        body={
          <span>
            Your bots message each other on their own to ask for context and hand off work. {active > 0 ? `${active} conversation${active > 1 ? "s" : ""} in progress.` : ""}
          </span>
        }
        title="Bot network"
      />
      {data && data.exchanges.length === 0 ? (
        <EmptyState
          action={
            <Link className={buttonSecondary} href="/app/threads/new">
              Start a thread with several bots
            </Link>
          }
          body="Ask one bot to loop in another (“ask Research for the numbers”), put several bots in a thread, or schedule a routine that collects updates from the team."
          title="No bot-to-bot conversations yet"
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button
              className={cn("rounded-full border px-3 py-1 text-[12.5px]", filter === "all" ? "border-white/30 bg-white/[0.08] text-white" : "border-white/[0.08] text-neutral-400")}
              onClick={() => setFilter("all")}
              type="button"
            >
              All bots
            </button>
            {state.bots.map((b) => (
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-3 pl-0.5 text-[12.5px]",
                  filter === b.id ? "border-white/30 bg-white/[0.08] text-white" : "border-white/[0.08] text-neutral-400",
                )}
                key={b.id}
                onClick={() => setFilter(b.id)}
                type="button"
              >
                <BotAvatar color={b.color} emoji={b.emoji} size="xs" /> {b.name}
              </button>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <Card className="scrollbar-thin max-h-[70vh] overflow-y-auto p-2">
              <ul className="space-y-0.5">
                {exchanges.map((x) => {
                  const from = bot(x.fromBotId);
                  const to = bot(x.toBotId);
                  return (
                    <li key={x.id}>
                      <button
                        className={cn("w-full rounded-2xl px-3 py-2.5 text-left transition-colors", selected?.id === x.id ? "bg-white/[0.07]" : "hover:bg-white/[0.03]")}
                        onClick={() => setSelectedId(x.id)}
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          <BotAvatar color={from?.color} emoji={from?.emoji} size="xs" />
                          <ArrowRightIcon className="size-3 text-neutral-600" />
                          <BotAvatar color={to?.color} emoji={to?.emoji} size="xs" />
                          <span className="truncate text-[12.5px] text-neutral-300">
                            {from?.name ?? "Bot"} → {to?.name ?? "Bot"}
                          </span>
                          <span
                            className={cn(
                              "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10.5px]",
                              x.status === "working" ? "bg-emerald-400/10 text-emerald-300" : x.status === "failed" ? "bg-red-400/10 text-red-300" : "bg-white/[0.05] text-neutral-500",
                            )}
                          >
                            {x.status}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-[13px] text-neutral-400">{x.subject}</div>
                        <div className="text-[11px] text-neutral-600">{timeAgo(x.updatedAt)}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
            {selected ? (
              <Card className="p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[14px] text-white">
                    <NetworkIcon className="size-4 text-neutral-500" />
                    {bot(selected.fromBotId)?.name} ↔ {bot(selected.toBotId)?.name}
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.threadId ? (
                      <Link className="text-[12.5px] text-neutral-500 hover:text-white" href={`/app/threads/${selected.threadId}`}>
                        Open thread
                      </Link>
                    ) : null}
                    {selected.childSessionId ? (
                      <button className={buttonSecondary} onClick={() => setShowWork((v) => !v)} type="button">
                        {showWork ? "Hide work" : `Watch ${bot(selected.toBotId)?.name ?? "teammate"} work`}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-4">
                  {selected.messages.map((m) => {
                    const author = bot(m.fromBotId);
                    const mine = m.fromBotId === selected.fromBotId;
                    return (
                      <div className={cn("flex gap-3", mine ? "" : "flex-row-reverse text-right")} key={m.id}>
                        <BotAvatar color={author?.color} emoji={author?.emoji} size="sm" />
                        <div className={cn("max-w-[85%] space-y-1", mine ? "" : "items-end")}>
                          <div className="text-[11.5px] text-neutral-500">
                            {author?.name} · {m.kind} · {timeAgo(m.createdAt)}
                          </div>
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2.5 text-left text-[13.5px]",
                              m.kind === "error" ? "border border-red-500/30 bg-red-500/[0.06] text-red-100" : mine ? "bg-white/[0.07] text-neutral-100" : "border border-white/10 text-neutral-200",
                            )}
                          >
                            <MessageResponse>{stripTeammateEnvelope(m.text)}</MessageResponse>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {selected.status === "working" ? (
                    <p className="shimmer-text text-[13px]">{bot(selected.toBotId)?.name} is working on it…</p>
                  ) : null}
                </div>
                {showWork && selected.childSessionId ? (
                  <div className="mt-6 border-t border-white/[0.06] pt-5">
                    <div className="mb-3 text-[12.5px] text-neutral-500">{bot(selected.toBotId)?.name}&apos;s session</div>
                    <SessionTranscript botId={selected.toBotId} key={selected.childSessionId} sessionId={selected.childSessionId} />
                  </div>
                ) : null}
              </Card>
            ) : null}
          </div>
        </>
      )}
    </AppPage>
  );
}

export default function NetworkPage() {
  return (
    <Suspense>
      <NetworkView />
    </Suspense>
  );
}
