"use client";

import { CrownIcon, HashIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app/app-state";
import { BotChat } from "@/components/app/chat/bot-chat";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api } from "@/lib/client";
import type { Bot, Thread } from "@shared/store/types";

export function ThreadView({ thread, members, lead }: { readonly thread: Thread; readonly members: Bot[]; readonly lead: Bot }) {
  const router = useRouter();
  const { state, refresh } = useAppState();
  const live = members.map((m) => state.bots.find((b) => b.id === m.id) ?? m);
  return (
    <BotChat
      bot={lead}
      header={
        <div className="flex items-center gap-3">
          <HashIcon className="size-4 text-neutral-500" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] text-white">{thread.title}</div>
            <div className="flex items-center gap-1 text-[11.5px] text-neutral-500">
              <CrownIcon className="size-3 text-amber-300/80" /> {lead.name} leads · {members.length} bots
            </div>
          </div>
          <div className="hidden -space-x-1.5 sm:flex">
            {live.map((m) => (
              <BotAvatar color={m.color} emoji={m.emoji} key={m.id} name={m.name} size="sm" status={m.status} />
            ))}
          </div>
          <button
            aria-label="Delete thread"
            className="text-neutral-600 hover:text-red-300"
            onClick={async () => {
              if (!window.confirm("Delete this thread?")) return;
              await api(`/api/threads/${thread.id}`, { method: "DELETE" });
              await refresh();
              router.push("/app");
            }}
            type="button"
          >
            <Trash2Icon className="size-4" />
          </button>
        </div>
      }
      members={live}
      mode="thread"
      sessionId={thread.sessionId}
      starters={[
        "Plan our Q3 offsite: agenda, announcement, and travel for 12 people.",
        "Everyone: send me a status update and flag anything blocked.",
        `@${members[1]?.name ?? lead.name} and @${lead.name}: split this up and report back.`,
      ]}
      threadId={thread.id}
    />
  );
}
