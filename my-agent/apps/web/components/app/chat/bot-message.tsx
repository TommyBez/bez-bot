"use client";

import type { EveDynamicToolPart, EveMessage, EveMessageInputRequest, EveMessagePart } from "eve/react";
import {
  BellIcon,
  BrainIcon,
  CalendarPlusIcon,
  CheckIcon,
  ChevronRightIcon,
  FileIcon,
  GlobeIcon,
  KeyRoundIcon,
  Loader2Icon,
  MonitorIcon,
  SearchIcon,
  TerminalIcon,
  XIcon,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { cn } from "@/lib/utils";
import { stripTeammateEnvelope } from "@shared/protocol";
import type { Bot, BotnetExchange, BotnetMessage } from "@shared/store/types";

export type ExchangeView = BotnetExchange & { messages: BotnetMessage[] };

export interface InputResponse {
  readonly optionId?: string;
  readonly requestId: string;
  readonly text?: string;
}

export interface MessageContext {
  readonly bots: Bot[];
  readonly speaker?: Bot;
  readonly exchanges: ExchangeView[];
  readonly canRespond: boolean;
  readonly onInputResponses: (responses: readonly InputResponse[]) => void | Promise<void>;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function describeTool(part: EveDynamicToolPart): { icon: ComponentType<{ className?: string }>; label: string; detail?: string } {
  const input = (part.input ?? {}) as Record<string, unknown>;
  switch (part.toolName) {
    case "bash":
      return { icon: TerminalIcon, label: "Ran a command", detail: str(input.command) };
    case "read_file":
      return { icon: FileIcon, label: "Read a file", detail: str(input.filePath ?? input.path) };
    case "write_file":
      return { icon: FileIcon, label: "Wrote a file", detail: str(input.filePath ?? input.path) };
    case "web_search":
      return { icon: SearchIcon, label: "Searched the web", detail: str(input.query ?? input.q) };
    case "web_fetch":
      return { icon: GlobeIcon, label: "Opened a page", detail: str(input.url) };
    case "computer": {
      const request = (input.request ?? {}) as Record<string, unknown>;
      const action = str(request.action);
      return {
        icon: MonitorIcon,
        label: action === "launch" ? `Opened ${str(request.app) || "an app"}` : action === "screenshot" ? "Looked at the screen" : `Used the computer: ${action || "action"}`,
        detail: str(request.url) || str(request.text).slice(0, 80),
      };
    }
    case "remember":
      return { icon: BrainIcon, label: input.scope === "team" ? "Updated team memory" : "Updated memory", detail: str(input.text) };
    case "forget":
      return { icon: BrainIcon, label: "Removed a memory" };
    case "save_routine":
      return { icon: CalendarPlusIcon, label: `Saved routine “${str(input.name)}”` };
    case "update_routine":
    case "run_routine":
    case "list_routines":
    case "delete_routine":
      return { icon: CalendarPlusIcon, label: part.toolName.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()) };
    case "notify_user":
      return { icon: BellIcon, label: "Sent you a notification", detail: str(input.title) };
    case "list_logins":
      return { icon: KeyRoundIcon, label: "Checked saved logins" };
    case "use_login":
      return { icon: KeyRoundIcon, label: "Signed in with a saved login" };
    case "sleep":
      return { icon: Loader2Icon, label: "Waiting", detail: input.seconds ? `${String(input.seconds)}s` : undefined };
    default:
      return { icon: ChevronRightIcon, label: part.toolName };
  }
}

function ToolRow({ part, ctx }: { readonly part: EveDynamicToolPart; readonly ctx: MessageContext }) {
  const [open, setOpen] = useState(false);
  const { icon: Icon, label, detail } = describeTool(part);
  const running = part.state === "input-streaming" || part.state === "input-available" || part.state === "approval-responded";
  const failed = part.state === "output-error" || part.state === "output-denied";
  const inputRequest = part.toolMetadata?.eve?.inputRequest;
  const needsApproval = part.state === "approval-requested" && inputRequest;

  return (
    <div className={cn("rounded-2xl border", needsApproval ? "border-amber-400/30 bg-amber-400/[0.05]" : "border-white/[0.07] bg-white/[0.02]")}>
      <button className="flex w-full items-center gap-2.5 px-3 py-2 text-left" onClick={() => setOpen((v) => !v)} type="button">
        <Icon className={cn("size-3.5 shrink-0", running ? "animate-pulse text-neutral-300" : failed ? "text-red-400" : "text-neutral-500")} />
        <span className="shrink-0 text-[12.5px] text-neutral-300">{label}</span>
        {detail ? <span className="min-w-0 truncate font-mono text-[11.5px] text-neutral-500">{detail}</span> : null}
        <span className="ml-auto shrink-0">
          {running ? (
            <Loader2Icon className="size-3.5 animate-spin text-neutral-500" />
          ) : failed ? (
            <XIcon className="size-3.5 text-red-400" />
          ) : part.state === "output-available" ? (
            <CheckIcon className="size-3.5 text-neutral-600" />
          ) : null}
        </span>
      </button>
      {needsApproval ? <ApprovalActions ctx={ctx} request={inputRequest} /> : null}
      {open ? (
        <div className="space-y-2 border-t border-white/[0.06] px-3 py-2.5">
          <pre className="scrollbar-thin max-h-48 overflow-auto rounded-lg bg-black/60 p-2 font-mono text-[11px] leading-relaxed text-neutral-400">
            {JSON.stringify(part.input, null, 2)}
          </pre>
          {part.state === "output-available" ? (
            <pre className="scrollbar-thin max-h-64 overflow-auto rounded-lg bg-black/60 p-2 font-mono text-[11px] leading-relaxed text-neutral-400">
              {typeof part.output === "string" ? part.output : JSON.stringify(part.output, null, 2)}
            </pre>
          ) : null}
          {part.state === "output-error" ? <p className="text-[12px] text-red-400">{part.errorText}</p> : null}
          {part.state === "output-denied" ? <p className="text-[12px] text-amber-300">Denied{part.approval.reason ? `: ${part.approval.reason}` : ""}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function ApprovalActions({ request, ctx }: { readonly request: EveMessageInputRequest; readonly ctx: MessageContext }) {
  const [pending, setPending] = useState<string>();
  return (
    <div className="space-y-2 border-t border-amber-400/20 px-3 py-2.5">
      <p className="text-[12.5px] text-amber-100/90">{request.prompt}</p>
      <div className="flex flex-wrap gap-2">
        {(request.options ?? []).map((option) => (
          <button
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] transition-colors disabled:opacity-50",
              option.style === "danger" || /deny|cancel|reject/i.test(option.label)
                ? "border border-white/15 text-neutral-300 hover:bg-white/[0.06]"
                : "bg-white font-medium text-black hover:bg-neutral-200",
            )}
            disabled={!ctx.canRespond || pending !== undefined}
            key={option.id}
            onClick={async () => {
              setPending(option.id);
              try {
                await ctx.onInputResponses([{ requestId: request.requestId, optionId: option.id }]);
              } finally {
                setPending(undefined);
              }
            }}
            type="button"
          >
            {pending === option.id ? <Loader2Icon className="size-3 animate-spin" /> : null}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuestionCard({ request, answered, ctx }: { readonly request: EveMessageInputRequest; readonly answered?: InputResponse; readonly ctx: MessageContext }) {
  const [text, setText] = useState("");
  const hasOptions = (request.options?.length ?? 0) > 0;
  const freeform = request.allowFreeform === true || !hasOptions;
  const disabled = !ctx.canRespond || answered !== undefined;
  return (
    <div className="space-y-3 rounded-2xl border border-sky-400/25 bg-sky-400/[0.05] p-3.5">
      <p className="text-[13.5px] text-sky-50">{request.prompt}</p>
      {hasOptions ? (
        <div className="space-y-1.5">
          {request.options!.map((option) => (
            <button
              className={cn(
                "flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-60",
                answered?.optionId === option.id ? "border-sky-300/50 bg-sky-300/10" : "border-white/10 hover:border-white/25",
              )}
              disabled={disabled}
              key={option.id}
              onClick={() => void ctx.onInputResponses([{ requestId: request.requestId, optionId: option.id }])}
              type="button"
            >
              <span className="flex-1">
                <span className="block text-[13px] text-white">{option.label}</span>
                {option.description ? <span className="block text-[12px] text-neutral-400">{option.description}</span> : null}
              </span>
              {answered?.optionId === option.id ? <CheckIcon className="mt-0.5 size-4 text-sky-300" /> : null}
            </button>
          ))}
        </div>
      ) : null}
      {freeform && !answered ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            void ctx.onInputResponses([{ requestId: request.requestId, text: text.trim() }]);
          }}
        >
          <input
            className="h-9 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-white/30"
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer…"
            value={text}
          />
          <button className="h-9 rounded-xl bg-white px-3 text-[12.5px] font-medium text-black disabled:opacity-50" disabled={disabled || !text.trim()} type="submit">
            Answer
          </button>
        </form>
      ) : null}
      {answered?.text ? <p className="text-[12.5px] text-neutral-400">You answered: {answered.text}</p> : null}
    </div>
  );
}

/** "Asking Research…" chip plus the teammate's reply, rendered as that bot's own message. */
function TeammateHandoff({ part, ctx }: { readonly part: EveDynamicToolPart; readonly ctx: MessageContext }) {
  const input = (part.input ?? {}) as { to?: string; message?: string; conversationId?: string };
  const target = ctx.bots.find(
    (b) => b.id === input.to || b.name.toLowerCase() === String(input.to ?? "").replace(/^@/, "").toLowerCase(),
  );
  const firstLine = String(input.message ?? "").split("\n")[0]!.slice(0, 140);
  const exchange = ctx.exchanges.find(
    (x) => (input.conversationId ? x.id === input.conversationId : x.subject === firstLine) && (!target || x.toBotId === target.id),
  );
  const reply = exchange?.messages.filter((m) => m.kind !== "request" && m.fromBotId === exchange.toBotId).at(-1);
  const refused =
    part.state === "output-available" && part.output && typeof part.output === "object" && (part.output as { delivered?: boolean }).delivered === false;
  const working = !refused && (!exchange || exchange.status === "working");
  const name = target?.name ?? String(input.to ?? "teammate");

  return (
    <div className="space-y-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pr-3 pl-1">
        <BotAvatar color={target?.color} emoji={target?.emoji} name={name} size="xs" />
        <span className="text-[12.5px] text-neutral-300">
          {refused ? `Couldn't reach ${name}` : working ? `Asking ${name}` : `${name} replied`}
        </span>
        {working ? (
          <span className="typing-dots flex gap-0.5 text-[10px] text-neutral-500">
            <span>●</span>
            <span>●</span>
            <span>●</span>
          </span>
        ) : refused ? (
          <XIcon className="size-3 text-red-400" />
        ) : (
          <CheckIcon className="size-3 text-emerald-400" />
        )}
      </div>
      {refused ? (
        <p className="pl-2 text-[12px] text-neutral-500">{String((part.output as { error?: string }).error ?? "")}</p>
      ) : null}
      {reply ? (
        <div className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
          <BotAvatar color={target?.color} emoji={target?.emoji} name={name} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-[12px] text-neutral-500">
              {name} <span className="text-neutral-700">→</span> {ctx.speaker?.name ?? "you"}
            </div>
            <div className="text-[13.5px] text-neutral-200">
              <MessageResponse>{stripTeammateEnvelope(reply.text)}</MessageResponse>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Part({ part, ctx, streaming }: { readonly part: EveMessagePart; readonly ctx: MessageContext; readonly streaming: boolean }) {
  switch (part.type) {
    case "step-start":
      return null;
    case "text":
      return (
        <div className="text-[14.5px] leading-relaxed text-neutral-100">
          <MessageResponse caret="block" isAnimating={streaming}>
            {part.text}
          </MessageResponse>
        </div>
      );
    case "reasoning":
      return part.text ? (
        <details className="group text-[12.5px] text-neutral-500">
          <summary className="cursor-pointer list-none">
            <span className={part.state === "streaming" ? "shimmer-text" : ""}>{part.state === "streaming" ? "Thinking…" : "Thought for a moment"}</span>
          </summary>
          <p className="mt-1 border-l border-white/10 pl-3 whitespace-pre-wrap">{part.text}</p>
        </details>
      ) : null;
    case "file":
      return part.mediaType.startsWith("image/") && part.url ? (
        <img alt={part.filename ?? "Attachment"} className="max-h-56 rounded-xl border border-white/10" src={part.url} />
      ) : (
        <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-[12.5px] text-neutral-300">
          <FileIcon className="size-3.5" /> {part.filename ?? part.mediaType}
        </span>
      );
    case "authorization":
      return (
        <div className="rounded-2xl border border-sky-400/25 bg-sky-400/[0.05] p-3 text-[13px] text-neutral-200">
          {part.state === "required" ? (
            <>
              <p>{part.description}</p>
              {part.authorization?.url ? (
                <a className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-[12.5px] font-medium text-black" href={part.authorization.url} rel="noreferrer" target="_blank">
                  Connect {part.displayName}
                </a>
              ) : null}
            </>
          ) : (
            <p>
              {part.displayName} {part.outcome === "authorized" ? "connected" : part.outcome}.
            </p>
          )}
        </div>
      );
    case "dynamic-tool": {
      const request = part.toolMetadata?.eve?.inputRequest;
      if (request?.kind === "question") {
        return <QuestionCard answered={part.toolMetadata?.eve?.inputResponse} ctx={ctx} request={request} />;
      }
      if (part.toolName === "message_bot") return <TeammateHandoff ctx={ctx} part={part} />;
      return <ToolRow ctx={ctx} part={part} />;
    }
  }
}

export function BotMessage({
  message,
  ctx,
  streaming,
  userName,
}: {
  readonly message: EveMessage;
  readonly ctx: MessageContext;
  readonly streaming: boolean;
  readonly userName: string;
}) {
  if (message.role === "user") {
    const texts = message.parts.filter((p) => p.type === "text").map((p) => (p.type === "text" ? p.text : ""));
    const files = message.parts.filter((p) => p.type === "file");
    const text = stripTeammateEnvelope(texts.join("\n"));
    const isRoutine = /<bezbot-routine /.test(texts.join("\n"));
    return (
      <div className="flex flex-col items-end gap-1.5" data-optimistic={message.metadata?.optimistic ? "true" : undefined}>
        {files.length > 0 ? (
          <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
            {files.map((f, i) => (
              <Part ctx={ctx} key={i} part={f} streaming={false} />
            ))}
          </div>
        ) : null}
        {text ? (
          <div
            className={cn(
              "max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[14.5px] whitespace-pre-wrap",
              isRoutine ? "border border-white/10 bg-transparent text-neutral-400" : "bg-white/[0.09] text-neutral-50",
            )}
          >
            {isRoutine ? text.replace(/<bezbot-routine[^>]*\/>\s*/, "⏰ ") : text}
          </div>
        ) : null}
        <span className="pr-1 text-[11px] text-neutral-600">{isRoutine ? "Schedule" : userName}</span>
      </div>
    );
  }

  const lastText = message.parts.reduce((last, p, i) => (p.type === "text" ? i : last), -1);
  const speaker = ctx.speaker;
  return (
    <div className="flex gap-3">
      <BotAvatar color={speaker?.color} emoji={speaker?.emoji} name={speaker?.name} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="text-[12px] text-neutral-500">{speaker?.name ?? "Bot"}</div>
        {message.parts.map((part, index) => (
          <Part ctx={ctx} key={part.type === "dynamic-tool" ? part.toolCallId : `${part.type}:${index}`} part={part} streaming={streaming && index === lastText} />
        ))}
      </div>
    </div>
  );
}
