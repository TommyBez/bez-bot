"use client";

import type { UserContent } from "ai";
import { useEveAgent } from "eve/react";
import {
  AlertCircleIcon,
  ArrowUpIcon,
  GraduationCapIcon,
  MonitorIcon,
  PaperclipIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { useAppState } from "@/components/app/app-state";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api, usePoll } from "@/lib/client";
import { cn } from "@/lib/utils";
import { CONTEXT_HEADER, encodeClientContext, type ClientSessionContext } from "@shared/protocol";
import type { Bot, Conversation as ConversationRecord } from "@shared/store/types";
import { BotMessage, type ExchangeView, type InputResponse } from "./bot-message";
import { ComputerPeek } from "./computer-peek";
import { TeachRecorder, type TeachCapture } from "./teach-recorder";

export interface BotChatProps {
  readonly mode: "dm" | "thread" | "teach";
  readonly bot: Bot;
  readonly members?: Bot[];
  readonly threadId?: string;
  readonly conversationId?: string;
  readonly sessionId?: string;
  readonly header: ReactNode;
  readonly starters?: string[];
  readonly autoRecord?: boolean;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function BotChat(props: BotChatProps) {
  const { mode, bot, members = [], threadId, header, starters = [] } = props;
  const { state, refresh } = useAppState();
  const conversationIdRef = useRef<string | undefined>(props.conversationId);
  const [sessionId, setSessionId] = useState<string | undefined>(props.sessionId);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>();
  const [showComputer, setShowComputer] = useState(false);
  const [recording, setRecording] = useState(Boolean(props.autoRecord) && mode === "teach");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const contextFor = useCallback((): ClientSessionContext => {
    if (mode === "thread") return { mode: "thread", threadId };
    return { mode, botId: bot.id, conversationId: conversationIdRef.current };
  }, [mode, threadId, bot.id]);

  const agent = useEveAgent({
    initialSession: props.sessionId ? { sessionId: props.sessionId, streamIndex: 0 } : undefined,
    resume: props.sessionId !== undefined,
    headers: () => ({ [CONTEXT_HEADER]: encodeClientContext(contextFor()) }),
    onSessionChange(session) {
      if (!session || session.sessionId === sessionId) return;
      setSessionId(session.sessionId);
      if (mode === "thread" && threadId) {
        void api(`/api/threads/${threadId}`, { method: "PATCH", json: { sessionId: session.sessionId } }).catch(() => undefined);
      } else if (conversationIdRef.current) {
        void api(`/api/conversations/${conversationIdRef.current}`, { method: "PATCH", json: { sessionId: session.sessionId } })
          .then(() => refresh())
          .catch(() => undefined);
      }
    },
  });

  const busy = agent.status === "submitted" || agent.status === "streaming";
  const resuming = agent.status === "resuming";
  const { data: network } = usePoll<{ exchanges: ExchangeView[] }>(
    sessionId ? `/api/network?sessionId=${encodeURIComponent(sessionId)}` : null,
    busy ? 2000 : 4000,
  );

  const liveBot = state.bots.find((b) => b.id === bot.id) ?? bot;
  const ctx = useMemo(
    () => ({
      bots: state.bots,
      speaker: liveBot,
      exchanges: network?.exchanges ?? [],
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
    [state.bots, liveBot, network?.exchanges, resuming, agent],
  );

  // Pending approvals or questions keep the bot parked; surface them in the header too.
  const pendingRequests = agent.data.messages
    .flatMap((m) => m.parts)
    .filter((p) => p.type === "dynamic-tool" && p.toolMetadata?.eve?.inputRequest && (p.state === "approval-requested" || !p.toolMetadata.eve.inputResponse)).length;

  async function ensureConversation(firstMessage: string): Promise<void> {
    if (mode === "thread" || conversationIdRef.current) return;
    const { conversation } = await api<{ conversation: ConversationRecord }>("/api/conversations", {
      method: "POST",
      json: { botId: bot.id, mode, title: firstMessage.slice(0, 60) || undefined },
    });
    conversationIdRef.current = conversation.id;
    // Keep the live stream mounted: Next's router would remount the page.
    History.prototype.replaceState.call(window.history, window.history.state, "", `/app/bots/${bot.id}/c/${conversation.id}`);
    void refresh();
  }

  async function sendParts(content: string | UserContent, preview: string) {
    setError(undefined);
    try {
      await ensureConversation(preview);
      await agent.send(content, busy ? { turnPolicy: "steer" } : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message failed to send.");
    }
  }

  async function submit() {
    const trimmed = text.trim();
    if ((!trimmed && files.length === 0) || resuming) return;
    const attachments = files;
    setText("");
    setFiles([]);
    if (attachments.length === 0) {
      await sendParts(trimmed, trimmed);
      return;
    }
    const parts: UserContent = [];
    if (trimmed) parts.push({ type: "text", text: trimmed });
    for (const file of attachments) {
      parts.push({ type: "file", data: await fileToDataUrl(file), mediaType: file.type || "application/octet-stream", filename: file.name });
    }
    await sendParts(parts, trimmed || attachments[0]!.name);
  }

  async function sendRecording(capture: TeachCapture) {
    const seconds = Math.round(capture.durationMs / 1000);
    const intro =
      capture.frames.length > 0
        ? `I recorded my screen while doing this task once (${capture.frames.length} frames over ${seconds}s, in order). Study it and turn it into a routine you can run on your own.`
        : "Here is a task I want you to learn. Turn it into a routine you can run on your own.";
    const body = [intro, capture.notes ? `My narration:\n${capture.notes}` : "", "Write the numbered steps, ask me about anything unclear, then save it with save_routine. Suggest a schedule if it repeats."]
      .filter(Boolean)
      .join("\n\n");
    const parts: UserContent = [{ type: "text", text: body }];
    capture.frames.forEach((frame, i) => {
      parts.push({ type: "file", data: frame.dataUrl, mediaType: "image/jpeg", filename: `step-${String(i + 1).padStart(2, "0")}.jpg` });
    });
    setRecording(false);
    await sendParts(parts, capture.notes || "Teaching a task");
  }

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const lastTurnFailure = useMemo(() => {
    for (let i = agent.events.length - 1; i >= 0; i -= 1) {
      const event = agent.events[i]!;
      if (event.type === "turn.failed") return event.data.code === "MODEL_CALL_FAILED" ? "The model is unavailable right now. Check your AI Gateway credentials and try again." : event.data.message;
      if (event.type === "turn.completed" || event.type === "message.received") return undefined;
    }
    return undefined;
  }, [agent.events]);
  const errorMessage = error ?? agent.error?.message ?? (busy ? undefined : lastTurnFailure);
  const lastMessage = agent.data.messages.at(-1);
  const thinking = busy && (lastMessage?.role !== "assistant" || lastMessage.parts.every((p) => p.type === "step-start"));
  const empty = agent.data.messages.length === 0 && !resuming;

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] pr-3 pl-14 md:pl-5">
          <div className="min-w-0 flex-1">{header}</div>
          {pendingRequests > 0 ? (
            <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-[12px] text-amber-300">{pendingRequests} waiting on you</span>
          ) : null}
          <button
            aria-label="Toggle computer"
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors",
              showComputer ? "border-white/25 bg-white/[0.08] text-white" : "border-white/10 text-neutral-400 hover:text-white",
            )}
            onClick={() => setShowComputer((v) => !v)}
            type="button"
          >
            <MonitorIcon className="size-3.5" /> Computer
          </button>
        </div>

        <Conversation className="min-h-0 flex-1" initial={props.sessionId ? false : undefined} resize={sessionId ? "instant" : "smooth"}>
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 pt-8 pb-10 sm:px-6">
            {empty ? (
              <div className="flex flex-col items-center gap-5 py-14 text-center">
                <div className="flex -space-x-3">
                  {(mode === "thread" ? members : [bot]).slice(0, 5).map((m) => (
                    <BotAvatar color={m.color} emoji={m.emoji} key={m.id} size="xl" />
                  ))}
                </div>
                <div>
                  <div className="text-2xl font-medium tracking-tight text-white">
                    {mode === "thread" ? "Give the team a job" : mode === "teach" ? `Show ${bot.name} how it's done` : `Message ${bot.name}`}
                  </div>
                  <div className="mx-auto mt-1.5 max-w-md text-[14px] text-neutral-500">
                    {mode === "thread"
                      ? "Everyone in this thread can pick up work. They'll hand tasks to each other and only come back for decisions."
                      : mode === "teach"
                        ? "Record yourself doing the task once. It saves it as a routine and runs it on its own next time."
                        : bot.job}
                  </div>
                </div>
                {starters.length > 0 && mode !== "teach" ? (
                  <div className="flex max-w-xl flex-wrap justify-center gap-2">
                    {starters.map((s) => (
                      <button
                        className="rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-white/25 hover:text-white"
                        key={s}
                        onClick={() => {
                          setText(s);
                          textareaRef.current?.focus();
                        }}
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
          {recording ? (
            <div className="mb-3">
              <TeachRecorder bot={liveBot} onCancel={() => setRecording(false)} onComplete={sendRecording} />
            </div>
          ) : null}
          {mode === "thread" && members.length > 1 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {members.map((m) => (
                <button
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] py-0.5 pr-2.5 pl-0.5 text-[12px] text-neutral-400 hover:border-white/20 hover:text-white"
                  key={m.id}
                  onClick={() => {
                    setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}@${m.name} `);
                    textareaRef.current?.focus();
                  }}
                  type="button"
                >
                  <BotAvatar color={m.color} emoji={m.emoji} size="xs" />@{m.name}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className="rounded-[22px] border border-white/10 bg-[#0c0c0e] p-2 focus-within:border-white/20"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {files.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 px-2 pt-1 pb-2">
                {files.map((f, i) => (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[12px] text-neutral-300" key={`${f.name}-${i}`}>
                    {f.name}
                    <button aria-label="Remove" onClick={() => setFiles((all) => all.filter((_, j) => j !== i))} type="button">
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <textarea
              className="max-h-48 min-h-11 w-full resize-none bg-transparent px-3 py-2 text-[14.5px] text-white outline-none placeholder:text-neutral-600"
              disabled={resuming}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={mode === "thread" ? "Message the thread… use @ to address a bot" : `Message ${liveBot.name}…`}
              ref={textareaRef}
              rows={1}
              value={text}
            />
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1">
                <input
                  className="hidden"
                  multiple
                  onChange={(e) => {
                    setFiles((all) => [...all, ...Array.from(e.target.files ?? [])]);
                    e.target.value = "";
                  }}
                  ref={fileInput}
                  type="file"
                />
                <button aria-label="Attach files" className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-white/[0.06] hover:text-white" onClick={() => fileInput.current?.click()} type="button">
                  <PaperclipIcon className="size-4" />
                </button>
                {mode !== "thread" ? (
                  <button
                    className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] text-neutral-500 hover:bg-white/[0.06] hover:text-white"
                    onClick={() => setRecording((v) => !v)}
                    type="button"
                  >
                    <GraduationCapIcon className="size-4" /> Teach a task
                  </button>
                ) : null}
              </div>
              {busy && !text.trim() && files.length === 0 ? (
                <button
                  aria-label="Stop"
                  className="flex size-8 items-center justify-center rounded-full border border-white/15 text-white hover:bg-white/[0.06]"
                  onClick={() => void agent.cancel().catch(() => undefined)}
                  type="button"
                >
                  <SquareIcon className="size-3 fill-current" />
                </button>
              ) : (
                <button
                  aria-label="Send"
                  className="flex size-8 items-center justify-center rounded-full bg-white text-black transition-opacity disabled:opacity-30"
                  disabled={resuming || (!text.trim() && files.length === 0)}
                  type="submit"
                >
                  <ArrowUpIcon className="size-4" />
                </button>
              )}
            </div>
          </form>
          <p className="mt-2 text-center text-[11px] text-neutral-600">
            {liveBot.name} works on its own computer and can message teammates. Sensitive actions go through Auto Review.
          </p>
        </div>
      </div>
      {showComputer ? (
        <aside className="hidden w-[340px] shrink-0 border-l border-white/[0.06] lg:block">
          <ComputerPeek onClose={() => setShowComputer(false)} />
        </aside>
      ) : null}
    </div>
  );
}
