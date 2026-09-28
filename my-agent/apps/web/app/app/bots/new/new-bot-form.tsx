"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAppState } from "@/components/app/app-state";
import { AppHeader, AppPage, buttonPrimary, Card, inputClass } from "@/components/app/page-header";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { getTemplate, TEMPLATES } from "@shared/templates";
import type { AutoReviewMode, Bot } from "@shared/store/types";

const EMOJIS = ["🤖", "📈", "🧭", "📣", "🧾", "📊", "🐞", "❤️‍🩹", "🧠", "🔬", "🎧", "✍️", "✈️", "🗂️", "🛠️", "🤝", "💡", "🦾"];
const COLORS = ["#3b82f6", "#a855f7", "#f97316", "#22c55e", "#06b6d4", "#ef4444", "#ec4899", "#eab308", "#14b8a6", "#6366f1", "#a3a3a3"];

export function NewBotForm({ initialTemplateId }: { readonly initialTemplateId: string }) {
  const router = useRouter();
  const { refresh } = useAppState();
  const [templateId, setTemplateId] = useState(getTemplate(initialTemplateId)?.id ?? "blank");
  const template = useMemo(() => getTemplate(templateId)!, [templateId]);
  const [name, setName] = useState(template.id === "blank" ? "" : template.name);
  const [job, setJob] = useState(template.id === "blank" ? "" : template.job);
  const [instructions, setInstructions] = useState(template.instructions);
  const [emoji, setEmoji] = useState(template.emoji);
  const [color, setColor] = useState(template.color);
  const [autoReview, setAutoReview] = useState<AutoReviewMode>("auto");
  const [autonomous, setAutonomous] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  function pick(id: string) {
    const t = getTemplate(id)!;
    setTemplateId(t.id);
    setName(t.id === "blank" ? "" : t.name);
    setJob(t.id === "blank" ? "" : t.job);
    setInstructions(t.instructions);
    setEmoji(t.emoji);
    setColor(t.color);
  }

  async function create() {
    setPending(true);
    setError(undefined);
    try {
      const { bot } = await api<{ bot: Bot }>("/api/bots", {
        method: "POST",
        json: {
          name: name || template.name,
          job: job || undefined,
          description: template.id === "blank" ? job : template.description,
          instructions,
          emoji,
          color,
          templateId: template.id === "blank" ? undefined : template.id,
          autoReview,
          autonomous,
        },
      });
      await refresh();
      router.push(`/app/bots/${bot.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the bot.");
      setPending(false);
    }
  }

  return (
    <AppPage wide>
      <AppHeader body="Give it a job. You can change everything later." title="Create a Bot" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 text-[14px] text-neutral-300">Start from a job</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button
                  className={cn(
                    "flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                    t.id === templateId ? "border-white/30 bg-white/[0.06]" : "border-white/[0.06] hover:border-white/15",
                  )}
                  key={t.id}
                  onClick={() => pick(t.id)}
                  type="button"
                >
                  <BotAvatar color={t.color} emoji={t.emoji} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-white">{t.name}</span>
                    <span className="block truncate text-[11.5px] text-neutral-500">{t.category}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[13px] text-neutral-400">Name</span>
                <input className={inputClass} onChange={(e) => setName(e.target.value)} placeholder="e.g. Account Manager" value={name} />
              </label>
              <label className="space-y-1.5">
                <span className="text-[13px] text-neutral-400">Job, in one line</span>
                <input className={inputClass} onChange={(e) => setJob(e.target.value)} placeholder="e.g. Keep every renewal on track." value={job} />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-[13px] text-neutral-400">How it should work</span>
              <textarea
                className={cn(inputClass, "min-h-40 font-mono text-[12.5px] leading-relaxed")}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="What it owns, what good looks like, who approves what, tools it should use…"
                value={instructions}
              />
            </label>
            <div className="space-y-2">
              <span className="text-[13px] text-neutral-400">Look</span>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map((e) => (
                  <button
                    className={cn("flex size-9 items-center justify-center rounded-xl border text-lg", e === emoji ? "border-white/40 bg-white/10" : "border-white/[0.06] hover:border-white/20")}
                    key={e}
                    onClick={() => setEmoji(e)}
                    type="button"
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {COLORS.map((c) => (
                  <button
                    aria-label={c}
                    className={cn("size-6 rounded-full border-2", c === color ? "border-white" : "border-transparent")}
                    key={c}
                    onClick={() => setColor(c)}
                    style={{ background: c }}
                    type="button"
                  />
                ))}
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div>
              <div className="text-[14px] text-white">Auto Review</div>
              <div className="text-[13px] text-neutral-500">What happens before a sensitive action (sending, spending, deleting).</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["auto", "Auto Review", "A reviewer model checks each action and asks you only when it's risky."],
                  ["always", "Always ask", "Every sensitive action waits for your approval."],
                  ["off", "Trust it", "Sensitive actions run without asking."],
                ] as const
              ).map(([value, label, desc]) => (
                <button
                  className={cn(
                    "rounded-2xl border p-3 text-left transition-colors",
                    autoReview === value ? "border-white/30 bg-white/[0.06]" : "border-white/[0.06] hover:border-white/15",
                  )}
                  key={value}
                  onClick={() => setAutoReview(value)}
                  type="button"
                >
                  <div className="text-[13.5px] text-white">{label}</div>
                  <div className="text-[12px] text-neutral-500">{desc}</div>
                </button>
              ))}
            </div>
            <label className="flex items-start gap-3 rounded-2xl border border-white/[0.06] p-3">
              <input checked={autonomous} className="mt-1 accent-white" onChange={(e) => setAutonomous(e.target.checked)} type="checkbox" />
              <span>
                <span className="block text-[13.5px] text-white">Let it talk to other bots on its own</span>
                <span className="block text-[12px] text-neutral-500">
                  It can message teammates for context and hand off work, including during scheduled routines.
                </span>
              </span>
            </label>
          </Card>
        </div>

        <div className="lg:sticky lg:top-10 lg:self-start">
          <Card className="relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full opacity-25 blur-3xl" style={{ background: color }} />
            <div className="relative space-y-4">
              <BotAvatar color={color} emoji={emoji} size="xl" />
              <div>
                <div className="text-xl font-medium text-white">{name || template.name}</div>
                <div className="text-[14px] text-neutral-400">{job || template.job}</div>
              </div>
              {template.routines.length > 0 ? (
                <div className="rounded-xl border border-white/[0.06] p-3 text-[12.5px] text-neutral-400">
                  Comes with {template.routines.length} routine{template.routines.length > 1 ? "s" : ""} (paused until you turn them on):
                  <ul className="mt-1 list-disc pl-4 text-neutral-500">
                    {template.routines.map((r) => (
                      <li key={r.name}>{r.name}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
              <button className={cn(buttonPrimary, "h-11 w-full")} disabled={pending} onClick={create} type="button">
                {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Create {name || template.name}
              </button>
            </div>
          </Card>
        </div>
      </div>
    </AppPage>
  );
}
