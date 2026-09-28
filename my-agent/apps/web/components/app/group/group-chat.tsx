"use client";

import { AlertCircleIcon, EyeIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { useAppState } from "@/components/app/app-state";
import { GroupMenu } from "@/components/app/bot-menu";
import { Composer } from "@/components/app/composer";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api, timeAgo, usePoll } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Bot, Group, GroupMessage } from "@shared/store/types";
import { GroupDetails } from "./group-details";
import { SeatPanel } from "./seat-panel";

type Panel = { kind: "settings" } | { kind: "seat"; botId: string } | null;

function highlightMentions(text: string, members: Bot[]): string {
  let out = text;
  for (const m of [...members].sort((a, b) => b.name.length - a.name.length)) {
    out = out.replace(new RegExp(`@${m.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"), `**@${m.name}**`);
  }
  return out.replace(/@everyone\b/gi, "**@everyone**");
}

/**
 * A group chat: you and two to six Bots. Write normally and the Bots decide
 * who answers, @-mention to hand a request to one teammate, and watch them
 * pass work among themselves.
 */
export function GroupChat({ group: initial }: { readonly group: Group }) {
  const { state, refresh } = useAppState();
  const group = state.groups.find((g) => g.id === initial.id) ?? initial;
  const members = group.memberBotIds.map((id) => state.bots.find((b) => b.id === id)).filter((b): b is Bot => Boolean(b));
  const working = members.filter((m) => group.working.includes(m.id));
  const { data, refresh: reload } = usePoll<{ messages: GroupMessage[] }>(`/api/groups/${group.id}/messages`, working.length > 0 ? 1500 : 3000);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string>();
  const messages = data?.messages ?? [];

  useEffect(() => {
    if (group.unread && document.visibilityState === "visible") {
      void api(`/api/groups/${group.id}`, { method: "PATCH", json: { unread: false } }).then(() => refresh()).catch(() => undefined);
    }
  }, [group.unread, group.lastMessageAt, group.id, refresh]);

  useEffect(() => {
    const el = document.getElementById("group-transcript-end");
    el?.scrollIntoView({ block: "end" });
  }, [messages.length, working.length]);

  const needsYou = members.filter((m) => m.status === "attention" && group.sessions[m.id]);
  const seatBot = panel?.kind === "seat" ? members.find((m) => m.id === panel.botId) : undefined;
  const nameOf = useMemo(() => (id: string) => (id === "user" ? state.user.name : (state.bots.find((b) => b.id === id)?.name ?? "A Bot")), [state]);

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.06] pr-2 pl-14 md:pl-4">
          <button className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => setPanel({ kind: "settings" })} type="button">
            <span className="flex -space-x-2">
              {members.slice(0, 4).map((m) => (
                <BotAvatar className="ring-2 ring-black" color={m.color} emoji={m.emoji} key={m.id} size="sm" />
              ))}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] text-white">{group.name}</span>
              <span className="block truncate text-[11.5px] text-neutral-500">
                {working.length > 0 ? `${working.map((w) => w.name).join(", ")} ${working.length > 1 ? "are" : "is"} typing…` : members.map((m) => m.name).join(", ")}
              </span>
            </span>
          </button>
          <button
            aria-label="Group settings"
            className="flex size-8 items-center justify-center rounded-full text-neutral-400 hover:text-white"
            onClick={() => setPanel((p) => (p?.kind === "settings" ? null : { kind: "settings" }))}
            type="button"
          >
            <SettingsIcon className="size-4" />
          </button>
          <GroupMenu group={group} />
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-8 pb-10 sm:px-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-14 text-center">
                <div className="flex -space-x-3">
                  {members.map((m) => (
                    <BotAvatar color={m.color} emoji={m.emoji} key={m.id} size="xl" />
                  ))}
                </div>
                <div className="text-2xl font-medium tracking-tight text-white">{group.name}</div>
                <p className="max-w-md text-[14px] text-neutral-500">
                  Describe the shared outcome and who owns the next step. Write normally to let the Bots decide who responds, or type @ to hand a request to one of them.
                </p>
              </div>
            ) : null}
            {messages.map((m) => {
              if (m.author === "user") {
                return (
                  <div className="flex flex-col items-end gap-1" key={m.id}>
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.09] px-4 py-2.5 text-[14.5px] text-neutral-50">
                      <MessageResponse>{highlightMentions(m.text, members)}</MessageResponse>
                    </div>
                    <span className="pr-1 text-[11px] text-neutral-600">
                      {state.user.name} · {timeAgo(m.createdAt)}
                    </span>
                  </div>
                );
              }
              const bot = state.bots.find((b) => b.id === m.author);
              return (
                <div className="flex gap-3" key={m.id}>
                  <BotAvatar className="mt-0.5" color={bot?.color} emoji={bot?.emoji} name={bot?.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2 text-[12px] text-neutral-500">
                      <span className="text-neutral-300">{nameOf(m.author)}</span>
                      <span>{timeAgo(m.createdAt)}</span>
                      {bot && group.sessions[bot.id] ? (
                        <button className="inline-flex items-center gap-1 hover:text-white" onClick={() => setPanel({ kind: "seat", botId: bot.id })} type="button">
                          <EyeIcon className="size-3" /> work
                        </button>
                      ) : null}
                    </div>
                    <div className="text-[14.5px] leading-relaxed text-neutral-100">
                      <MessageResponse>{highlightMentions(m.text, members)}</MessageResponse>
                    </div>
                  </div>
                </div>
              );
            })}
            {working.map((w) => (
              <button className="flex items-center gap-3 text-left" key={w.id} onClick={() => setPanel({ kind: "seat", botId: w.id })} type="button">
                <BotAvatar color={w.color} emoji={w.emoji} size="sm" />
                <span className="shimmer-text text-[13.5px]">{w.name} is working…</span>
              </button>
            ))}
            {needsYou.map((m) => (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.05] px-3.5 py-2.5" key={m.id}>
                <BotAvatar color={m.color} emoji={m.emoji} size="xs" />
                <span className="flex-1 text-[13px] text-amber-100">{m.name} needs your approval to continue.</span>
                <button className="rounded-full bg-white px-3 py-1 text-[12.5px] font-medium text-black" onClick={() => setPanel({ kind: "seat", botId: m.id })} type="button">
                  Review
                </button>
              </div>
            ))}
            {error ? (
              <div className="flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/[0.06] px-3.5 py-2.5 text-[13px]" role="alert">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-red-400" />
                <span className="text-red-100/90">{error}</span>
              </div>
            ) : null}
            <div id="group-transcript-end" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {members.map((m) => (
              <Link
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] py-0.5 pr-2.5 pl-0.5 text-[12px] text-neutral-400 hover:border-white/20 hover:text-white"
                href={`/app/bots/${m.id}`}
                key={m.id}
              >
                <BotAvatar color={m.color} emoji={m.emoji} size="xs" />
                {m.name}
              </Link>
            ))}
          </div>
          <Composer
            allowAttachments={false}
            allowEveryone
            draftKey={`group:${group.id}`}
            mentionable={members}
            onSubmit={async (text) => {
              setError(undefined);
              try {
                await api(`/api/groups/${group.id}/messages`, { method: "POST", json: { text } });
                await Promise.all([reload(), refresh()]);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Message failed to send.");
              }
            }}
            placeholder={`Message ${group.name}… type @ to address a Bot`}
          />
        </div>
      </div>
      {panel ? (
        <aside className={cn("fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-white/[0.06] bg-[#080809] lg:static lg:z-auto lg:w-[360px] lg:max-w-none")}>
          {panel.kind === "settings" ? (
            <GroupDetails group={group} onClose={() => setPanel(null)} />
          ) : seatBot && group.sessions[seatBot.id] ? (
            <SeatPanel bot={seatBot} key={seatBot.id} onClose={() => setPanel(null)} sessionId={group.sessions[seatBot.id]!} />
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
