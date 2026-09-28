"use client";

import { ArrowLeftIcon, CheckIcon, CopyIcon, Link2Icon, Loader2Icon, PlayIcon, Trash2Icon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppState } from "@/components/app/app-state";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api, timeAgo, usePoll } from "@/lib/client";
import { cn } from "@/lib/utils";
import { describeSchedule } from "@shared/schedule";
import type { Bot, MemoryDoc, Routine } from "@shared/store/types";

export type DetailsTab = "settings" | "tasks" | "memory";

const EMOJIS = ["🤖", "📈", "🔬", "🧠", "🐞", "❤️‍🩹", "🧾", "📊", "📣", "🧭", "✈️", "🎧", "✍️", "🗂️", "🛠️", "🦊", "🐙", "🌱"];
const COLORS = ["#3b82f6", "#a855f7", "#f97316", "#22c55e", "#06b6d4", "#ef4444", "#ec4899", "#eab308", "#14b8a6", "#a3a3a3"];

const field = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-neutral-600 focus:border-white/30";
const pill = "inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-[12.5px] transition-colors disabled:opacity-50";

function Toggle({ on, onChange, label }: { readonly on: boolean; readonly onChange: (next: boolean) => void; readonly label: string }) {
  return (
    <button
      aria-checked={on}
      aria-label={label}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-emerald-500" : "bg-white/15")}
      onClick={() => onChange(!on)}
      role="switch"
      type="button"
    >
      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", on ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

function BotSettings({ bot }: { readonly bot: Bot }) {
  const { refresh } = useAppState();
  const [draft, setDraft] = useState({ name: bot.name, label: bot.label, description: bot.description, emoji: bot.emoji, color: bot.color });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | undefined>(bot.shareId ? `/b/${bot.shareId}` : undefined);
  const [copied, setCopied] = useState(false);
  const dirty =
    draft.name !== bot.name || draft.label !== bot.label || draft.description !== bot.description || draft.emoji !== bot.emoji || draft.color !== bot.color;

  useEffect(() => {
    setDraft({ name: bot.name, label: bot.label, description: bot.description, emoji: bot.emoji, color: bot.color });
  }, [bot.id, bot.name, bot.label, bot.description, bot.emoji, bot.color]);

  async function save() {
    setSaving(true);
    try {
      await api(`/api/bots/${bot.id}`, { method: "PATCH", json: draft });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <BotAvatar color={draft.color} emoji={draft.emoji} size="lg" />
          <div className="flex flex-wrap gap-1">
            {COLORS.map((c) => (
              <button
                aria-label={`Color ${c}`}
                className={cn("size-5 rounded-full border-2", draft.color === c ? "border-white" : "border-transparent")}
                key={c}
                onClick={() => setDraft((d) => ({ ...d, color: c }))}
                style={{ background: c }}
                type="button"
              />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button
              className={cn("flex size-8 items-center justify-center rounded-lg text-[16px]", draft.emoji === e ? "bg-white/15" : "hover:bg-white/[0.06]")}
              key={e}
              onClick={() => setDraft((d) => ({ ...d, emoji: e }))}
              type="button"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <label className="block space-y-1.5">
        <span className="text-[12px] text-neutral-400">Name</span>
        <input className={field} maxLength={60} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} value={draft.name} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-[12px] text-neutral-400">Label (optional)</span>
        <input
          className={field}
          maxLength={140}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          placeholder="One primary job, e.g. Product performance"
          value={draft.label}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-[12px] text-neutral-400">Description</span>
        <textarea
          className={cn(field, "min-h-40 resize-y leading-relaxed")}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="Its job and standing rules, e.g. Never send external messages without approval."
          value={draft.description}
        />
        <span className="block text-[11.5px] text-neutral-600">{bot.name} reads this on every turn. Put task-specific requests in the chat.</span>
      </label>
      <button className={cn(pill, "bg-white px-4 font-medium text-black hover:bg-neutral-200")} disabled={!dirty || saving} onClick={() => void save()} type="button">
        {saving ? <Loader2Icon className="size-3.5 animate-spin" /> : saved ? <CheckIcon className="size-3.5" /> : null}
        {saved ? "Saved" : "Save"}
      </button>

      <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <div>
          <div className="text-[13px] text-white">Notifications</div>
          <div className="text-[12px] text-neutral-500">Get notified when this Bot finishes or needs input.</div>
        </div>
        <Toggle
          label="Notifications"
          on={bot.notifications}
          onChange={async (next) => {
            if (next && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
            await api(`/api/bots/${bot.id}`, { method: "PATCH", json: { notifications: next } });
            await refresh();
          }}
        />
      </div>

      <div className="space-y-2 border-t border-white/[0.06] pt-4">
        <div className="text-[13px] text-white">Share</div>
        <div className="text-[12px] text-neutral-500">A template link shares identity, description, skills, and routines. Never your computer, logins, or history.</div>
        {shareUrl ? (
          <div className="flex flex-wrap gap-2">
            <button
              className={cn(pill, "border border-white/15 text-white hover:bg-white/[0.06]")}
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              type="button"
            >
              {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />} {copied ? "Copied" : "Copy link"}
            </button>
            <a className={cn(pill, "text-neutral-400 hover:text-white")} href={shareUrl} rel="noreferrer" target="_blank">
              View template
            </a>
            <button
              className={cn(pill, "text-neutral-400 hover:text-white")}
              onClick={async () => {
                const { url } = await api<{ url: string }>(`/api/bots/${bot.id}/share`, { method: "POST" });
                setShareUrl(url);
              }}
              type="button"
            >
              Update template
            </button>
          </div>
        ) : (
          <button
            className={cn(pill, "border border-white/15 text-white hover:bg-white/[0.06]")}
            onClick={async () => {
              const { url } = await api<{ url: string }>(`/api/bots/${bot.id}/share`, { method: "POST" });
              setShareUrl(url);
              await refresh();
            }}
            type="button"
          >
            <Link2Icon className="size-3.5" /> Create template
          </button>
        )}
      </div>
    </div>
  );
}

function RoutineDetail({
  routine,
  onBack,
  onEdit,
  onChanged,
}: {
  readonly routine: Routine;
  readonly onBack: () => void;
  readonly onEdit: (text: string) => void;
  readonly onChanged: () => Promise<void>;
}) {
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string>();
  const [showKey, setShowKey] = useState(false);
  const webhook = typeof window === "undefined" ? "" : `${window.location.origin}/api/routines/${routine.id}/webhook`;
  return (
    <div className="space-y-4">
      <button className="flex items-center gap-1.5 text-[12.5px] text-neutral-400 hover:text-white" onClick={onBack} type="button">
        <ArrowLeftIcon className="size-3.5" /> Routines
      </button>
      <div className="text-[15px] font-medium text-white">{routine.name}</div>
      <div className="space-y-1">
        <div className="text-[11.5px] tracking-wide text-neutral-500 uppercase">Instruction</div>
        <p className="text-[13px] whitespace-pre-wrap text-neutral-300">{routine.instruction}</p>
      </div>
      <div className="space-y-1">
        <div className="text-[11.5px] tracking-wide text-neutral-500 uppercase">When to run</div>
        <p className="text-[13px] text-neutral-300">
          {routine.enabled ? describeSchedule(routine.schedule) : "Paused"}
          {routine.enabled && routine.nextRunAt ? <span className="text-neutral-500"> · next {new Date(routine.nextRunAt).toLocaleString()}</span> : null}
        </p>
      </div>
      <div className="space-y-1">
        <div className="text-[11.5px] tracking-wide text-neutral-500 uppercase">Webhook</div>
        <p className="text-[12px] text-neutral-500">POST to</p>
        <code className="block rounded-lg bg-black/50 px-2 py-1.5 font-mono text-[11px] break-all text-neutral-400">{webhook}</code>
        <p className="text-[12px] text-neutral-500">Header</p>
        <code className="block rounded-lg bg-black/50 px-2 py-1.5 font-mono text-[11px] break-all text-neutral-400">
          Authorization: Bearer {showKey ? routine.webhookKey : "••••••••••••"}
        </code>
        <button className="text-[12px] text-neutral-500 hover:text-white" onClick={() => setShowKey((v) => !v)} type="button">
          {showKey ? "Hide key" : "Show key"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className={cn(pill, "border border-white/15 text-white hover:bg-white/[0.06]")}
          onClick={async () => {
            await api(`/api/routines/${routine.id}`, { method: "PATCH", json: { enabled: !routine.enabled } });
            await onChanged();
          }}
          type="button"
        >
          {routine.enabled ? "Pause" : "Resume"}
        </button>
        <button
          className={cn(pill, "border border-white/15 text-white hover:bg-white/[0.06]")}
          disabled={testing}
          onClick={async () => {
            setTesting(true);
            setError(undefined);
            try {
              await api(`/api/routines/${routine.id}`, { method: "POST" });
              await onChanged();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't start a test run.");
            } finally {
              setTesting(false);
            }
          }}
          type="button"
        >
          {testing ? <Loader2Icon className="size-3.5 animate-spin" /> : <PlayIcon className="size-3.5" />} {testing ? "Running…" : "Test"}
        </button>
        <button className={cn(pill, "border border-white/15 text-white hover:bg-white/[0.06]")} onClick={() => onEdit(`Edit your routine: ${routine.name} `)} type="button">
          Edit
        </button>
        <button
          className={cn(pill, "text-red-300 hover:bg-red-500/10")}
          onClick={async () => {
            if (!window.confirm(`Delete routine “${routine.name}”? This can't be undone.`)) return;
            await api(`/api/routines/${routine.id}`, { method: "DELETE" });
            await onChanged();
            onBack();
          }}
          type="button"
        >
          <Trash2Icon className="size-3.5" /> Delete routine
        </button>
      </div>
      {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
      <p className="text-[11.5px] text-neutral-600">A test does real work. The result shows up in the Bot's chat.</p>
      <div className="space-y-1.5">
        <div className="text-[11.5px] tracking-wide text-neutral-500 uppercase">Run history</div>
        {routine.runs.length === 0 ? (
          <p className="text-[12.5px] text-neutral-500">No runs yet</p>
        ) : (
          <ul className="space-y-1">
            {routine.runs.map((run) => (
              <li className="flex items-center justify-between text-[12.5px]" key={run.id}>
                <span className={cn(run.status === "failed" ? "text-red-300" : run.status === "running" ? "text-amber-200" : "text-neutral-300")}>
                  {run.status === "running" ? "Running" : run.status === "succeeded" ? "Succeeded" : "Failed"}
                  <span className="text-neutral-600"> · {run.trigger === "test" ? "Test" : run.trigger === "webhook" ? "Webhook" : "Schedule"}</span>
                </span>
                <span className="text-neutral-500">{timeAgo(run.startedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Tasks({ bot, onEdit }: { readonly bot: Bot; readonly onEdit: (text: string) => void }) {
  const { data, refresh } = usePoll<{ routines: Routine[] }>(`/api/routines?botId=${bot.id}`, 5000);
  const [openId, setOpenId] = useState<string>();
  const routines = data?.routines ?? [];
  const open = routines.find((r) => r.id === openId);
  if (open) return <RoutineDetail onBack={() => setOpenId(undefined)} onChanged={refresh} onEdit={onEdit} routine={open} />;
  return (
    <div className="space-y-3">
      <div className="text-[11.5px] tracking-wide text-neutral-500 uppercase">Routines</div>
      {routines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center">
          <div className="text-[13px] text-neutral-300">Ask in chat to set a routine</div>
          <button className="mt-2 text-[12.5px] text-neutral-500 hover:text-white" onClick={() => onEdit("Every weekday at 9:00 AM, ")} type="button">
            e.g. “Every weekday at 9:00 AM, summarize…”
          </button>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {routines.map((r) => (
            <li className="flex items-center gap-3 rounded-xl border border-white/[0.07] px-3 py-2.5" key={r.id}>
              <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(r.id)} type="button">
                <span className="block truncate text-[13px] text-white">{r.name}</span>
                <span className="block truncate text-[12px] text-neutral-500">{r.enabled ? describeSchedule(r.schedule) : "Paused"}</span>
              </button>
              <Toggle
                label={r.enabled ? "Pause" : "Resume"}
                on={r.enabled}
                onChange={async (next) => {
                  await api(`/api/routines/${r.id}`, { method: "PATCH", json: { enabled: next } });
                  await refresh();
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Memory({ bot }: { readonly bot: Bot }) {
  const { data, refresh } = usePoll<{ memory: MemoryDoc }>(`/api/bots/${bot.id}/memory`, 8000);
  const entries = data?.memory.entries ?? [];
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-neutral-500">
        What {bot.name} has learned about how you work. Correct it in chat when something changes; remove anything stale.
      </p>
      {entries.length === 0 ? (
        <p className="text-[12.5px] text-neutral-500">Nothing yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {[...entries].reverse().map((e) => (
            <li className="group flex items-start gap-2 rounded-xl border border-white/[0.07] px-3 py-2" key={e.id}>
              <span className="flex-1 text-[13px] text-neutral-300">{e.text}</span>
              <button
                aria-label="Remove"
                className="text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-white"
                onClick={async () => {
                  await api(`/api/bots/${bot.id}/memory?entry=${e.id}`, { method: "DELETE" });
                  await refresh();
                }}
                type="button"
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "View conversation details": Bot settings, Tasks (routines), and memory. */
export function DetailsPanel({
  bot,
  tab,
  onTab,
  onClose,
  onPrefill,
}: {
  readonly bot: Bot;
  readonly tab: DetailsTab;
  readonly onTab: (tab: DetailsTab) => void;
  readonly onClose: () => void;
  readonly onPrefill: (text: string) => void;
}) {
  const tabs: { id: DetailsTab; label: string }[] = [
    { id: "settings", label: "Bot settings" },
    { id: "tasks", label: "Tasks" },
    { id: "memory", label: "Memory" },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <BotAvatar color={bot.color} emoji={bot.emoji} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] text-white">{bot.name}</div>
          <div className="truncate text-[11.5px] text-neutral-500">{bot.label || "Conversation details"}</div>
        </div>
        <button aria-label="Close" className="text-neutral-500 hover:text-white" onClick={onClose} type="button">
          <XIcon className="size-4" />
        </button>
      </div>
      <div className="flex gap-1 border-b border-white/[0.06] px-3 py-2">
        {tabs.map((t) => (
          <button
            className={cn("rounded-full px-3 py-1 text-[12.5px]", tab === t.id ? "bg-white/[0.1] text-white" : "text-neutral-500 hover:text-white")}
            key={t.id}
            onClick={() => onTab(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "settings" ? <BotSettings bot={bot} /> : tab === "tasks" ? <Tasks bot={bot} onEdit={onPrefill} /> : <Memory bot={bot} />}
      </div>
    </div>
  );
}
