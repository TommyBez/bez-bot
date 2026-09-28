"use client";

import type { UserContent } from "ai";
import { useEveAgent } from "eve/react";
import { AlertCircleIcon, MonitorIcon, PanelRightIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { useAppState } from "@/components/app/app-state";
import { BotMenu } from "@/components/app/bot-menu";
import { Composer, type ComposerHandle } from "@/components/app/composer";
import { BotAvatar, StatusDot } from "@/components/bez/bot-avatar";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { CONTEXT_HEADER, encodeClientContext } from "@shared/protocol";
import type { Bot } from "@shared/store/types";
import { getTemplate } from "@shared/templates";
import { BotMessage, type InputResponse } from "./bot-message";
import { ComputerPeek } from "./computer-peek";
import { DetailsPanel, type DetailsTab } from "./details-panel";
import { TeachRecorder, type TeachCapture } from "./teach-recorder";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type Panel = { kind: "computer" } | { kind: "details"; tab: DetailsTab } | null;

/**
 * A Bot's one conversation. Everything lands here: your messages, the Bot's
 * work, messages to and from other Bots, routine runs, and approvals.
 */
export function BotChat({ bot, sessionId, initialDetails }: { readonly bot: Bot; readonly sessionId: string; readonly initialDetails?: DetailsTab }) {
  const { state, refresh } = useAppState();
  const liveBot = state.bots.find((b) => b.id === bot.id) ?? bot;
  const [error, setError] = useState<string>();
  const [panel, setPanel] = useState<Panel>(initialDetails ? { kind: "details", tab: initialDetails } : null);
  const [teaching, setTeaching] = useState(false);
  const composer = useRef<ComposerHandle | null>(null);

  const agent = useEveAgent({
    initialSession: { sessionId, streamIndex: 0 },
    resume: true,
    headers: () => ({ [CONTEXT_HEADER]: encodeClientContext({ botId: bot.id }) }),
  });

  const busy = agent.status === "submitted" || agent.status === "streaming";
  const resuming = agent.status === "resuming";

  // Opening the conversation marks it read, and keeps it read while you watch.
  useEffect(() => {
    if (!liveBot.unread || document.visibilityState !== "visible") return;
    void api(`/api/bots/${bot.id}`, { method: "PATCH", json: { unread: false } }).then(() => refresh()).catch(() => undefined);
  }, [liveBot.unread, liveBot.lastMessageAt, bot.id, refresh]);

  const ctx = useMemo(
    () => ({
      bots: state.bots,
      speaker: liveBot,
      canRespond: !resuming,
      onInputResponses: async (responses: readonly InputResponse[]) => {
        setError(undefined);
        try {
          await agent.respond(responses.map((r) => ({ ...r })));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not send your answer.");
        }
      },
    }),
    [state.bots, liveBot, resuming, agent],
  );

  async function send(content: string | UserContent) {
    setError(undefined);
    try {
      // A message from you takes priority and can redirect the current turn.
      await agent.send(content, busy ? { turnPolicy: "steer" } : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message failed to send.");
    }
  }

  async function submit(text: string, files: File[]) {
    if (files.length === 0) return send(text);
    const parts: UserContent = [];
    if (text) parts.push({ type: "text", text });
    for (const file of files) {
      parts.push({ type: "file", data: await fileToDataUrl(file), mediaType: file.type || "application/octet-stream", filename: file.name });
    }
    return send(parts);
  }

  async function sendRecording(capture: TeachCapture) {
    const seconds = Math.round(capture.durationMs / 1000);
    const body = [
      `Teach a task: ${capture.notes.split("\n")[0]?.slice(0, 80) || "a workflow I just showed you"}`,
      capture.frames.length > 0
        ? `I recorded my screen while doing this once (${capture.frames.length} frames over ${seconds}s, in order).`
        : "Here's the workflow, described in my own words.",
      capture.notes ? `What I was doing:\n${capture.notes}` : "",
      "Write it up as a draft skill with save_skill (draft: true): when to use it, inputs and access, numbered steps, how to check the result, and what needs approval. Ask me about anything unclear.",
    ]
      .filter(Boolean)
      .join("\n\n");
    const parts: UserContent = [{ type: "text", text: body }];
    capture.frames.forEach((frame, i) => {
      parts.push({ type: "file", data: frame.dataUrl, mediaType: "image/jpeg", filename: `step-${String(i + 1).padStart(2, "0")}.jpg` });
    });
    setTeaching(false);
    await send(parts);
  }

  const lastTurnFailure = useMemo(() => {
    for (let i = agent.events.length - 1; i >= 0; i -= 1) {
      const event = agent.events[i]!;
      if (event.type === "turn.failed") {
        return event.data.code === "MODEL_CALL_FAILED" ? "The model is unavailable right now. Check your AI Gateway credentials and try again." : event.data.message;
      }
      if (event.type === "turn.completed" || event.type === "message.received") return undefined;
    }
    return undefined;
  }, [agent.events]);

  const errorMessage = error ?? agent.error?.message ?? (busy ? undefined : lastTurnFailure);
  const lastMessage = agent.data.messages.at(-1);
  const thinking = busy && (lastMessage?.role !== "assistant" || lastMessage.parts.every((p) => p.type === "step-start"));
  const empty = agent.data.messages.length === 0 && !resuming;
  const working = busy || liveBot.status === "working";
  const teammates = state.bots.filter((b) => b.id !== bot.id);
  const starters = getTemplate(liveBot.templateId)?.starters ?? [];

  const statusLine = working ? (
    <span className="flex items-center gap-1.5 text-emerald-400/90">
      <span className="typing-dots flex gap-0.5 text-[8px]">
        <span>●</span>
        <span>●</span>
        <span>●</span>
      </span>
      {liveBot.statusText && liveBot.statusText !== "Working" ? liveBot.statusText : "typing"}
    </span>
  ) : liveBot.status === "attention" ? (
    <span className="text-amber-300">Needs attention</span>
  ) : (
    <span>{liveBot.label || "Bot"}</span>
  );

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.06] pr-2 pl-14 md:pl-4">
          <button
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1 text-left"
            onClick={() => setPanel((p) => (p?.kind === "details" ? null : { kind: "details", tab: "settings" }))}
            title="View conversation details"
            type="button"
          >
            <span className="relative">
              <BotAvatar color={liveBot.color} emoji={liveBot.emoji} size="sm" />
              <StatusDot className="absolute -right-0.5 -bottom-0.5" status={liveBot.status} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] text-white">{liveBot.name}</span>
              <span className="block truncate text-[11.5px] text-neutral-500">{statusLine}</span>
            </span>
          </button>
          <button
            aria-label="Agent Computer"
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors",
              panel?.kind === "computer" ? "border-white/25 bg-white/[0.08] text-white" : "border-white/10 text-neutral-400 hover:text-white",
            )}
            onClick={() => setPanel((p) => (p?.kind === "computer" ? null : { kind: "computer" }))}
            type="button"
          >
            <MonitorIcon className="size-3.5" /> <span className="hidden sm:inline">Computer</span>
          </button>
          <button
            aria-label="View conversation details"
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition-colors",
              panel?.kind === "details" ? "bg-white/[0.08] text-white" : "text-neutral-400 hover:text-white",
            )}
            onClick={() => setPanel((p) => (p?.kind === "details" ? null : { kind: "details", tab: "settings" }))}
            type="button"
          >
            <PanelRightIcon className="size-4" />
          </button>
          <BotMenu bot={liveBot} onEditProfile={() => setPanel({ kind: "details", tab: "settings" })} />
        </div>

        <Conversation className="min-h-0 flex-1" initial={false} resize="instant">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 pt-8 pb-10 sm:px-6">
            {empty ? (
              <div className="flex flex-col items-center gap-5 py-14 text-center">
                <BotAvatar color={liveBot.color} emoji={liveBot.emoji} size="xl" />
                <div>
                  <div className="text-2xl font-medium tracking-tight text-white">{liveBot.name}</div>
                  <div className="mx-auto mt-1.5 max-w-md text-[14px] text-neutral-500">
                    {liveBot.label || "Tell this Bot what job it owns. It keeps this one conversation, so context carries over."}
                  </div>
                </div>
                {starters.length > 0 ? (
                  <div className="flex max-w-xl flex-wrap justify-center gap-2">
                    {starters.map((s) => (
                      <button
                        className="rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-white/25 hover:text-white"
                        key={s}
                        onClick={() => composer.current?.prefill(s)}
                        type="button"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {agent.data.messages.map((message, index) =>
              thinking && message.id === lastMessage?.id && message.role === "assistant" ? null : (
                <BotMessage
                  ctx={ctx}
                  key={message.id}
                  message={message}
                  streaming={agent.status === "streaming" && index === agent.data.messages.length - 1}
                  userName={state.user.name}
                />
              ),
            )}

            {thinking ? (
              <div className="flex items-center gap-3">
                <BotAvatar color={liveBot.color} emoji={liveBot.emoji} size="sm" />
                <span className="shimmer-text text-[13.5px]">{liveBot.name} is working…</span>
              </div>
            ) : null}

            {errorMessage ? (
              <div className="flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/[0.06] px-3.5 py-2.5 text-[13px]" role="alert">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-red-400" />
                <span className="text-red-100/90">{errorMessage}</span>
              </div>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
          {teaching ? (
            <div className="mb-3">
              <TeachRecorder bot={liveBot} onCancel={() => setTeaching(false)} onComplete={sendRecording} />
            </div>
          ) : null}
          <Composer
            busy={busy}
            disabled={resuming}
            draftKey={`bot:${bot.id}`}
            mentionable={teammates}
            onStop={() => void agent.cancel().catch(() => undefined)}
            onSubmit={submit}
            placeholder={`Message ${liveBot.name}…`}
            ref={composer}
          />
        </div>
      </div>
      {panel ? (
        <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-white/[0.06] bg-[#080809] lg:static lg:z-auto lg:w-[360px] lg:max-w-none">
          {panel.kind === "computer" ? (
            <ComputerPeek
              botId={bot.id}
              onClose={() => setPanel(null)}
              onTeach={() => {
                setTeaching(true);
                setPanel(null);
              }}
            />
          ) : (
            <DetailsPanel
              bot={liveBot}
              onClose={() => setPanel(null)}
              onPrefill={(text) => {
                composer.current?.prefill(text);
                if (window.innerWidth < 1024) setPanel(null);
              }}
              onTab={(tab) => setPanel({ kind: "details", tab })}
              tab={panel.tab}
            />
          )}
        </aside>
      ) : null}
    </div>
  );
}
