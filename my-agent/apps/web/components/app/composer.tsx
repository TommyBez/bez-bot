"use client";

import { ArrowUpIcon, MicIcon, PaperclipIcon, SquareIcon, XIcon } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { usePoll } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Bot, Skill } from "@shared/store/types";

export const MAX_ATTACHMENTS = 6;

export interface ComposerHandle {
  /** Replaces the draft and focuses the box, e.g. "Edit your routine: …". */
  prefill: (text: string) => void;
  focus: () => void;
}

interface Suggestion {
  key: string;
  insert: string;
  label: string;
  hint?: string;
  bot?: Bot;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function speechRecognition(): (new () => SpeechRecognitionLike) | undefined {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Current `/` or `@` token before the caret, if any. */
function activeToken(text: string, caret: number): { trigger: "/" | "@"; query: string; start: number } | null {
  const before = text.slice(0, caret);
  const match = /(^|\s)([/@])([\w-]*)$/.exec(before);
  if (!match) return null;
  return { trigger: match[2] as "/" | "@", query: match[3]!.toLowerCase(), start: caret - match[3]!.length - 1 };
}

export const Composer = forwardRef<
  ComposerHandle,
  {
    readonly placeholder: string;
    readonly mentionable: Bot[];
    readonly busy?: boolean;
    readonly disabled?: boolean;
    readonly allowAttachments?: boolean;
    readonly allowEveryone?: boolean;
    readonly onSubmit: (text: string, files: File[]) => void | Promise<void>;
    readonly onStop?: () => void;
    readonly draftKey?: string;
  }
>(function Composer({ placeholder, mentionable, busy, disabled, allowAttachments = true, allowEveryone, onSubmit, onStop, draftKey }, ref) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [listening, setListening] = useState(false);
  // Browser-only capability; decided after mount so server and client render the same markup.
  const [canDictate, setCanDictate] = useState(false);
  useEffect(() => setCanDictate(speechRecognition() !== undefined), []);
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const { data: skillData } = usePoll<{ skills: Skill[] }>("/api/skills", 30_000);

  // Drafts are saved per conversation when you navigate away.
  useEffect(() => {
    if (!draftKey) return;
    try {
      setText(localStorage.getItem(`draft:${draftKey}`) ?? "");
    } catch {
      // storage unavailable
    }
  }, [draftKey]);
  useEffect(() => {
    if (!draftKey) return;
    try {
      if (text) localStorage.setItem(`draft:${draftKey}`, text);
      else localStorage.removeItem(`draft:${draftKey}`);
    } catch {
      // storage unavailable
    }
  }, [draftKey, text]);

  useImperativeHandle(ref, () => ({
    prefill(next: string) {
      setText(next);
      requestAnimationFrame(() => {
        textarea.current?.focus();
        textarea.current?.setSelectionRange(next.length, next.length);
      });
    },
    focus() {
      textarea.current?.focus();
    },
  }));

  const token = activeToken(text, caret);
  const suggestions = useMemo<Suggestion[]>(() => {
    if (!token) return [];
    if (token.trigger === "/") {
      return (skillData?.skills ?? [])
        .filter((s) => s.slug.includes(token.query) || s.name.toLowerCase().includes(token.query))
        .slice(0, 8)
        .map((s) => ({ key: s.id, insert: `/${s.slug} `, label: `/${s.slug}`, hint: s.draft ? `${s.name} (draft)` : s.name }));
    }
    const bots = mentionable
      .filter((b) => b.name.toLowerCase().replace(/\s+/g, "").includes(token.query))
      .slice(0, 8)
      .map((b) => ({ key: b.id, insert: `@${b.name} `, label: b.name, hint: b.label, bot: b }));
    return allowEveryone && "everyone".startsWith(token.query)
      ? [...bots, { key: "everyone", insert: "@everyone ", label: "everyone", hint: "Every Bot in this group" }]
      : bots;
  }, [token, skillData?.skills, mentionable, allowEveryone]);

  useEffect(() => setHighlight(0), [token?.trigger, token?.query]);

  function apply(s: Suggestion) {
    if (!token) return;
    const next = `${text.slice(0, token.start)}${s.insert}${text.slice(caret)}`;
    const pos = token.start + s.insert.length;
    setText(next);
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  }

  async function submit() {
    const trimmed = text.trim();
    if ((!trimmed && files.length === 0) || disabled) return;
    const attachments = files;
    setText("");
    setFiles([]);
    await onSubmit(trimmed, attachments);
  }

  function toggleDictation() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Recognition = speechRecognition();
    if (!Recognition) return;
    const r = new Recognition();
    r.continuous = true;
    r.interimResults = false;
    const base = text;
    r.onresult = (event) => {
      const heard = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setText(`${base}${base && !base.endsWith(" ") ? " " : ""}${heard}`);
    };
    r.onend = () => setListening(false);
    recognition.current = r;
    r.start();
    setListening(true);
  }

  const empty = !text.trim() && files.length === 0;

  return (
    <form
      className="relative rounded-[22px] border border-white/10 bg-[#0c0c0e] p-2 focus-within:border-white/20"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {suggestions.length > 0 ? (
        <div className="absolute right-2 bottom-full left-2 mb-2 overflow-hidden rounded-2xl border border-white/10 bg-[#111113] py-1 shadow-2xl">
          <div className="px-3 pt-1.5 pb-1 text-[11px] text-neutral-500">{token?.trigger === "/" ? "Skills" : "Mention"}</div>
          {suggestions.map((s, i) => (
            <button
              className={cn("flex w-full items-center gap-2.5 px-3 py-1.5 text-left", i === highlight ? "bg-white/[0.07]" : "hover:bg-white/[0.04]")}
              key={s.key}
              onMouseDown={(e) => {
                e.preventDefault();
                apply(s);
              }}
              type="button"
            >
              {s.bot ? <BotAvatar color={s.bot.color} emoji={s.bot.emoji} size="xs" /> : null}
              <span className="text-[13px] text-white">{s.label}</span>
              {s.hint ? <span className="truncate text-[12px] text-neutral-500">{s.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
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
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={(e) => {
          if (suggestions.length > 0) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => (h + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              apply(suggestions[highlight]!);
              return;
            }
          }
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          }
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
        placeholder={placeholder}
        ref={textarea}
        rows={1}
        value={text}
      />
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1">
          {allowAttachments ? (
            <>
              <input
                className="hidden"
                multiple
                onChange={(e) => {
                  setFiles((all) => [...all, ...Array.from(e.target.files ?? [])].slice(0, MAX_ATTACHMENTS));
                  e.target.value = "";
                }}
                ref={fileInput}
                type="file"
              />
              <button
                aria-label="Attach files"
                className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-white/[0.06] hover:text-white"
                onClick={() => fileInput.current?.click()}
                type="button"
              >
                <PaperclipIcon className="size-4" />
              </button>
            </>
          ) : null}
          {canDictate ? (
            <button
              aria-label={listening ? "Stop voice input" : "Start voice input"}
              className={cn(
                "flex size-8 items-center justify-center rounded-full hover:bg-white/[0.06]",
                listening ? "text-red-400" : "text-neutral-500 hover:text-white",
              )}
              onClick={toggleDictation}
              type="button"
            >
              <MicIcon className="size-4" />
            </button>
          ) : null}
          <span className="hidden pl-1 text-[11px] text-neutral-600 sm:inline">/ skills · @ teammates</span>
        </div>
        {busy && empty && onStop ? (
          <button
            aria-label="Stop"
            className="flex size-8 items-center justify-center rounded-full border border-white/15 text-white hover:bg-white/[0.06]"
            onClick={onStop}
            type="button"
          >
            <SquareIcon className="size-3 fill-current" />
          </button>
        ) : (
          <button
            aria-label="Send"
            className="flex size-8 items-center justify-center rounded-full bg-white text-black transition-opacity disabled:opacity-30"
            disabled={disabled || empty}
            type="submit"
          >
            <ArrowUpIcon className="size-4" />
          </button>
        )}
      </div>
    </form>
  );
});
