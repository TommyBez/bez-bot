"use client";

import { useEveAgent } from "eve/react";
import { useAppState } from "@/components/app/app-state";
import { usePoll } from "@/lib/client";
import { BotMessage, type ExchangeView } from "./bot-message";

/** Read-only replay of a durable session (a routine run or a teammate's work), following it live if still running. */
export function SessionTranscript({ sessionId, botId }: { readonly sessionId: string; readonly botId: string }) {
  const { state } = useAppState();
  const agent = useEveAgent({ initialSession: { sessionId, streamIndex: 0 }, resume: true });
  const { data: network } = usePoll<{ exchanges: ExchangeView[] }>(`/api/network?sessionId=${encodeURIComponent(sessionId)}`, 4000);
  const speaker = state.bots.find((b) => b.id === botId);
  const ctx = {
    bots: state.bots,
    speaker,
    exchanges: network?.exchanges ?? [],
    canRespond: agent.status === "ready",
    onInputResponses: async (responses: readonly { requestId: string; optionId?: string; text?: string }[]) => {
      await agent.respond(responses.map((r) => ({ ...r })));
    },
  };
  if (agent.status === "resuming" && agent.data.messages.length === 0) {
    return <p className="shimmer-text text-[13px]">Loading transcript…</p>;
  }
  if (agent.error && agent.data.messages.length === 0) {
    return <p className="text-[13px] text-neutral-500">Transcript unavailable: {agent.error.message}</p>;
  }
  return (
    <div className="space-y-5">
      {agent.data.messages.map((message, i) => (
        <BotMessage
          ctx={ctx}
          key={message.id}
          message={message}
          streaming={agent.status === "streaming" && i === agent.data.messages.length - 1}
          userName={state.user.name}
        />
      ))}
      {agent.status === "streaming" ? <p className="shimmer-text text-[12.5px]">Still working…</p> : null}
    </div>
  );
}
