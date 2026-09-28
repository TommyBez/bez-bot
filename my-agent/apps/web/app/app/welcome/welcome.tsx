"use client";

import { ArrowRightIcon, CalendarClockIcon, Loader2Icon, MessagesSquareIcon, MonitorIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppState } from "@/components/app/app-state";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Bot } from "@shared/store/types";
import { FEATURED_TEMPLATES } from "@shared/templates";

const INTRO = [
  { icon: MessagesSquareIcon, title: "Bots", body: "Each Bot has a name, a job, and one ongoing conversation with you. Context carries over, so you never re-explain." },
  { icon: MonitorIcon, title: "A shared computer", body: "Your Bots share one cloud computer with a browser, terminal, and files. Each gets its own screen, and they hand work to each other." },
  { icon: CalendarClockIcon, title: "Routines", body: "Ask a Bot to do something on a schedule. It runs on its own, even with your laptop closed, and posts the result in its chat." },
];

const field = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-neutral-600 focus:border-white/30";

export function Welcome({ firstBotId }: { readonly firstBotId: string }) {
  const router = useRouter();
  const { refresh } = useAppState();
  const [step, setStep] = useState<"intro" | "meet">("intro");
  const [own, setOwn] = useState({ name: "", label: "", description: "" });
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  async function finish(input?: { templateId?: string; name?: string; label?: string; description?: string }, key = "skip") {
    setBusy(key);
    setError(undefined);
    try {
      let target = firstBotId;
      if (input) target = (await api<{ bot: Bot }>("/api/bots", { method: "POST", json: input })).bot.id;
      await api("/api/me", { method: "PATCH", json: { onboarded: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      await refresh();
      router.push(`/app/bots/${target}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(undefined);
    }
  }

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 pt-20 pb-16">
        {step === "intro" ? (
          <div className="space-y-8">
            <div className="space-y-2">
              <h1 className="text-3xl font-medium tracking-tight text-white">Welcome to Bez Bot</h1>
              <p className="text-[15px] text-neutral-400">AI teammates you can give real work to. Here's how it works.</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {INTRO.map(({ icon: Icon, title, body }) => (
                <div className="flex gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4" key={title}>
                  <Icon className="mt-0.5 size-5 shrink-0 text-neutral-300" />
                  <div>
                    <div className="text-[14.5px] text-white">{title}</div>
                    <div className="text-[13.5px] text-neutral-400">{body}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[12.5px] text-neutral-500">Your computer is getting ready in the background.</p>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-medium text-black"
              onClick={() => setStep("meet")}
              type="button"
            >
              Continue <ArrowRightIcon className="size-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="space-y-2">
              <h1 className="text-3xl font-medium tracking-tight text-white">Meet a future teammate</h1>
              <p className="text-[15px] text-neutral-400">Pick a suggested Bot or create your own. You can always add more with New.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FEATURED_TEMPLATES.map((t) => (
                <button
                  className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-left transition-colors hover:border-white/20 disabled:opacity-50"
                  disabled={!!busy}
                  key={t.id}
                  onClick={() => void finish({ templateId: t.id }, t.id)}
                  type="button"
                >
                  <BotAvatar color={t.color} emoji={t.emoji} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] text-white">{t.name}</span>
                    <span className="block text-[12.5px] text-neutral-500">{t.job}</span>
                  </span>
                  {busy === t.id ? <Loader2Icon className="size-4 animate-spin text-neutral-400" /> : null}
                </button>
              ))}
            </div>
            <div className="space-y-3 rounded-2xl border border-white/[0.08] p-4">
              <div className="text-[14.5px] text-white">Create your own</div>
              <input className={field} onChange={(e) => setOwn((o) => ({ ...o, name: e.target.value }))} placeholder="A short name, e.g. Piper" value={own.name} />
              <input className={field} onChange={(e) => setOwn((o) => ({ ...o, label: e.target.value }))} placeholder="One primary job, e.g. Product performance" value={own.label} />
              <textarea
                className={cn(field, "min-h-24 resize-y")}
                onChange={(e) => setOwn((o) => ({ ...o, description: e.target.value }))}
                placeholder="Description: what it owns and how it should work"
                value={own.description}
              />
              <button
                className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-[13.5px] font-medium text-black disabled:opacity-40"
                disabled={!own.name.trim() || !!busy}
                onClick={() => void finish(own, "own")}
                type="button"
              >
                {busy === "own" ? <Loader2Icon className="size-4 animate-spin" /> : null} Create {own.name.trim() || "Bot"}
              </button>
            </div>
            {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
            <button className="text-[13px] text-neutral-500 hover:text-white" disabled={!!busy} onClick={() => void finish(undefined)} type="button">
              Skip for now, start with Bez Bot
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
