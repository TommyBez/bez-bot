"use client";

import { useEveAgent } from "eve/react";
import { XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { useAppState } from "@/components/app/app-state";
import { BotMessage, type InputResponse } from "@/components/app/chat/bot-message";
import { BotAvatar } from "@/components/bez/bot-avatar";
import type { Bot } from "@shared/store/types";

/**
 * One member's work in this group: its tool activity, files, and any approval
 * it is waiting on. Read-only apart from answering those requests.
 */
export function SeatPanel({ bot, sessionId, onClose }: { readonly bot: Bot; readonly sessionId: string; readonly onClose: () => void }) {
  const { state } = useAppState();
  const [error, setError] = useState<string>();
  const agent = useEveAgent({ initialSession: { sessionId, streamIndex: 0 }, resume: true });
  const ctx = useMemo(
    () => ({
      bots: state.bots,
      speaker: bot,
      canRespond: agent.status !== "resuming",
      onInputResponses: async (responses: readonly InputResponse[]) => {
        setError(undefined);
        try {
          await agent.respond(responses.map((r) => ({ ...r })));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not send your answer.");
        }
      },
    }),
    [state.bots, bot, agent],
  );
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <BotAvatar color={bot.color} emoji={bot.emoji} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] text-white">{bot.name}'s work</div>
          <div className="text-[11.5px] text-neutral-500">In this group</div>
        </div>
        <button aria-label="Close" className="text-neutral-500 hover:text-white" onClick={onClose} type="button">
          <XIcon className="size-4" />
        </button>
      </div>
      <Conversation className="min-h-0 flex-1" initial={false} resize="instant">
        <ConversationContent className="gap-5 px-4 py-5">
          {agent.data.messages
            .filter((m) => m.role === "assistant")
            .map((message, index, all) => (
              <BotMessage
                ctx={ctx}
                key={message.id}
                message={message}
                streaming={agent.status === "streaming" && index === all.length - 1}
                userName={state.user.name}
              />
            ))}
          {agent.data.messages.length === 0 ? <p className="text-[12.5px] text-neutral-500">Nothing here yet.</p> : null}
          {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
        </ConversationContent>
      </Conversation>
    </div>
  );
}
