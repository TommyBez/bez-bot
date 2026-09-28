"use client";

import type { EveDynamicToolPart, EveMessage, EveMessageInputRequest, EveMessagePart } from "eve/react";
import {
  AlarmClockIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
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
  ShieldCheckIcon,
  TerminalIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, type ComponentType } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { actionSummary, actionTitle, proposeRuleMatch } from "@shared/actions";
import { parseRoutineHeader, parseTeammateHeader, stripHeaders } from "@shared/protocol";
import type { Bot } from "@shared/store/types";

export interface InputResponse {
  readonly optionId?: string;
  readonly requestId: string;
  readonly text?: string;
}

export interface MessageContext {
  readonly bots: Bot[];
  readonly speaker?: Bot;
  readonly canRespond: boolean;
  readonly onInputResponses: (responses: readonly InputResponse[]) => void | Promise<void>;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function findBot(bots: Bot[], ref: unknown): Bot | undefined {
  const needle = str(ref).replace(/^@/, "").toLowerCase();
  return bots.find((b) => b.id === ref || b.name.toLowerCase() === needle);
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
      return { icon: BrainIcon, label: "Updated memory", detail: str(input.text) };
    case "forget":
      return { icon: BrainIcon, label: "Removed a memory" };
    case "save_routine":
      return { icon: CalendarPlusIcon, label: `Created routine “${str(input.name)}”` };
    case "update_routine":
      return { icon: CalendarPlusIcon, label: "Updated a routine" };
    case "list_routines":
      return { icon: CalendarPlusIcon, label: "Checked routines" };
    case "delete_routine":
      return { icon: CalendarPlusIcon, label: "Deleted a routine" };
    case "save_skill":
      return { icon: BookOpenIcon, label: input.draft ? `Drafted skill “${str(input.name)}”` : `Saved skill “${str(input.name)}”` };
    case "use_skill":
      return { icon: BookOpenIcon, label: "Used a skill", detail: str(input.name) };
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

/** "Review an action": Allow once, Always allow (saves a rule), or Deny. */
function ReviewAction({ part, request, ctx }: { readonly part: EveDynamicToolPart; readonly request: EveMessageInputRequest; readonly ctx: MessageContext }) {
  const [pending, setPending] = useState<string>();
  const options = request.options ?? [];
  const deny = options.find((o) => o.style === "danger" || /deny|reject|cancel/i.test(o.label));
  const allow = options.find((o) => o !== deny);
  const summary = actionSummary(part.toolName, part.input);

  async function answer(kind: "once" | "always" | "deny") {
    const option = kind === "deny" ? deny : allow;
    if (!option) return;
    setPending(kind);
    try {
      if (kind === "always") {
        await api("/api/autoreview", {
          method: "POST",
          json: { kind: "allow", tool: part.toolName, match: proposeRuleMatch(part.toolName, part.input) },
        }).catch(() => undefined);
      }
      await ctx.onInputResponses([{ requestId: request.requestId, optionId: option.id }]);
    } finally {
      setPending(undefined);
    }
  }

  const button = "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] transition-colors disabled:opacity-50";
  return (
    <div className="space-y-2.5 border-t border-amber-400/20 px-3.5 py-3">
      <div className="flex items-center gap-2 text-[13px] font-medium text-amber-100">
        <ShieldCheckIcon className="size-4" /> Review an action
      </div>
      <div className="text-[12.5px] text-neutral-300">
        {actionTitle(part.toolName)}
        {summary && part.toolName !== "use_login" ? (
          <code className="mt-1 block rounded-lg bg-black/50 px-2 py-1.5 font-mono text-[11.5px] break-all text-neutral-400">{summary}</code>
        ) : null}
      </div>
      {request.prompt ? <p className="text-[12px] text-neutral-500">{request.prompt}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button className={cn(button, "bg-white font-medium text-black hover:bg-neutral-200")} disabled={!ctx.canRespond || !!pending} onClick={() => void answer("once")} type="button">
          {pending === "once" ? <Loader2Icon className="size-3 animate-spin" /> : null}Allow once
        </button>
        <button className={cn(button, "border border-white/15 text-white hover:bg-white/[0.06]")} disabled={!ctx.canRespond || !!pending} onClick={() => void answer("always")} type="button">
          {pending === "always" ? <Loader2Icon className="size-3 animate-spin" /> : null}Always allow
        </button>
        <button className={cn(button, "text-neutral-400 hover:bg-white/[0.06] hover:text-white")} disabled={!ctx.canRespond || !!pending} onClick={() => void answer("deny")} type="button">
          {pending === "deny" ? <Loader2Icon className="size-3 animate-spin" /> : null}Deny
        </button>
      </div>
    </div>
  );
}

function ToolRow({ part, ctx }: { readonly part: EveDynamicToolPart; readonly ctx: MessageContext }) {
  const [open, setOpen] = useState(false);
  const described = describeTool(part);
  const { icon: Icon, detail } = described;
  const running = part.state === "input-streaming" || part.state === "input-available" || part.state === "approval-responded";
  const failed = part.state === "output-error" || part.state === "output-denied";
  const inputRequest = part.toolMetadata?.eve?.inputRequest;
  const needsApproval = part.state === "approval-requested" && inputRequest;
  // Until it runs, say what the Bot wants to do rather than what it did.
  const label = needsApproval ? `Wants to ${actionTitle(part.toolName).toLowerCase()}` : failed && part.state === "output-denied" ? `Didn't ${actionTitle(part.toolName).toLowerCase()}` : described.label;

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
      {needsApproval ? <ReviewAction ctx={ctx} part={part} request={inputRequest} /> : null}
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

/** A message this Bot sent to a teammate. The teammate's reply arrives later in this chat. */
function Handoff({ part, ctx }: { readonly part: EveDynamicToolPart; readonly ctx: MessageContext }) {
  const [open, setOpen] = useState(false);
  const input = (part.input ?? {}) as { to?: string; message?: string };
  const target = findBot(ctx.bots, input.to);
  const name = target?.name ?? str(input.to).replace(/^@/, "") ?? "teammate";
  const output = (part.state === "output-available" && part.output && typeof part.output === "object" ? part.output : {}) as {
    sent?: boolean;
    error?: string;
  };
  const failed = part.state === "output-error" || output.sent === false;
  const sending = !failed && part.state !== "output-available";
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <button className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left" onClick={() => setOpen((v) => !v)} type="button">
        <BotAvatar color={target?.color} emoji={target?.emoji} name={name} size="xs" />
        <span className="text-[12.5px] text-neutral-300">{failed ? `Couldn't message ${name}` : sending ? `Messaging ${name}…` : `Messaged ${name}`}</span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-500">{str(input.message).split("\n")[0]}</span>
        {sending ? <Loader2Icon className="size-3.5 animate-spin text-neutral-500" /> : failed ? <XIcon className="size-3.5 text-red-400" /> : <CheckIcon className="size-3.5 text-neutral-600" />}
      </button>
      {open ? (
        <div className="space-y-2 border-t border-white/[0.06] px-3 py-2.5 text-[13px] text-neutral-300">
          <MessageResponse>{str(input.message)}</MessageResponse>
          {failed ? <p className="text-[12px] text-red-400">{output.error ?? (part.state === "output-error" ? part.errorText : "")}</p> : null}
        </div>
      ) : null}
      {target && !failed ? (
        <Link className="flex items-center gap-1 border-t border-white/[0.06] px-3 py-1.5 text-[11.5px] text-neutral-500 hover:text-white" href={`/app/bots/${target.id}`}>
          Open {target.name}'s chat <ArrowUpRightIcon className="size-3" />
        </Link>
      ) : null}
    </div>
  );
}

function CreatedBot({ part, ctx }: { readonly part: EveDynamicToolPart; readonly ctx: MessageContext }) {
  const output = (part.state === "output-available" && part.output && typeof part.output === "object" ? part.output : {}) as { id?: string; name?: string };
  const bot = output.id ? ctx.bots.find((b) => b.id === output.id) : undefined;
  if (part.state === "approval-requested") return <ToolRow ctx={ctx} part={part} />;
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
      <UserPlusIcon className="size-3.5 text-neutral-500" />
      <span className="text-[12.5px] text-neutral-300">
        {output.id ? `Created ${output.name ?? "a Bot"}` : `Creating ${str((part.input as { name?: string } | undefined)?.name)}…`}
      </span>
      {bot ? (
        <Link className="ml-auto inline-flex items-center gap-1 text-[12px] text-neutral-400 hover:text-white" href={`/app/bots/${bot.id}`}>
          Open <ArrowUpRightIcon className="size-3" />
        </Link>
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
      if (part.toolName === "message_bot") return <Handoff ctx={ctx} part={part} />;
      if (part.toolName === "create_bot") return <CreatedBot ctx={ctx} part={part} />;
      return <ToolRow ctx={ctx} part={part} />;
    }
  }
}

/** A teammate's message, shown as that Bot talking in this chat. */
function IncomingTeammate({ header, ctx }: { readonly header: NonNullable<ReturnType<typeof parseTeammateHeader>>; readonly ctx: MessageContext }) {
  const from = ctx.bots.find((b) => b.id === header.fromBotId);
  const name = from?.name ?? header.fromName;
  return (
    <div className="flex gap-3">
      <BotAvatar className="mt-0.5" color={from?.color} emoji={from?.emoji} name={name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5 text-[12px] text-neutral-500">
          {from ? (
            <Link className="text-neutral-300 hover:text-white" href={`/app/bots/${from.id}`}>
              {name}
            </Link>
          ) : (
            <span className="text-neutral-300">{name}</span>
          )}
          <span>{header.kind === "reply" ? "replied" : "sent a message"}</span>
        </div>
        <div className="rounded-2xl rounded-tl-md border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-neutral-100">
          <MessageResponse>{header.body}</MessageResponse>
        </div>
      </div>
    </div>
  );
}

function RoutineRunRow({ header }: { readonly header: NonNullable<ReturnType<typeof parseRoutineHeader>> }) {
  const [open, setOpen] = useState(false);
  const trigger = header.trigger === "test" ? "Test run" : header.trigger === "webhook" ? "Webhook" : "Scheduled run";
  return (
    <div className="flex flex-col items-center">
      <button
        className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-3 py-1 text-[12px] text-neutral-400 hover:text-neutral-200"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <AlarmClockIcon className="size-3.5" /> {header.name} · {trigger}
      </button>
      {open ? (
        <div className="mt-2 w-full max-w-xl rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5 text-[13px] text-neutral-400">
          <MessageResponse>{header.body}</MessageResponse>
        </div>
      ) : null}
    </div>
  );
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
    const raw = message.parts.filter((p) => p.type === "text").map((p) => (p.type === "text" ? p.text : "")).join("\n");
    const teammate = parseTeammateHeader(raw);
    if (teammate) return <IncomingTeammate ctx={ctx} header={teammate} />;
    const routine = parseRoutineHeader(raw);
    if (routine) return <RoutineRunRow header={routine} />;
    const files = message.parts.filter((p) => p.type === "file");
    const text = stripHeaders(raw);
    return (
      <div className="flex flex-col items-end gap-1.5" data-optimistic={message.metadata?.optimistic ? "true" : undefined}>
        {files.length > 0 ? (
          <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
            {files.map((f, i) => (
              <Part ctx={ctx} key={i} part={f} streaming={false} />
            ))}
          </div>
        ) : null}
        {text ? <div className="max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.09] px-4 py-2.5 text-[14.5px] whitespace-pre-wrap text-neutral-50">{text}</div> : null}
        <span className="pr-1 text-[11px] text-neutral-600">{userName}</span>
      </div>
    );
  }

  const lastText = message.parts.reduce((last, p, i) => (p.type === "text" ? i : last), -1);
  const speaker = ctx.speaker;
  return (
    <div className="flex gap-3">
      <BotAvatar className="mt-0.5" color={speaker?.color} emoji={speaker?.emoji} name={speaker?.name} size="sm" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="text-[12px] text-neutral-500">{speaker?.name ?? "Bot"}</div>
        {message.parts.map((part, index) => (
          <Part ctx={ctx} key={part.type === "dynamic-tool" ? part.toolCallId : `${part.type}:${index}`} part={part} streaming={streaming && index === lastText} />
        ))}
      </div>
    </div>
  );
}
