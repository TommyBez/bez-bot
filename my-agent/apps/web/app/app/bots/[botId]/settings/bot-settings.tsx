"use client";

import { ArrowLeftIcon, CheckIcon, CopyIcon, Loader2Icon, Share2Icon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppState } from "@/components/app/app-state";
import { AppHeader, AppPage, buttonPrimary, buttonSecondary, Card, inputClass } from "@/components/app/page-header";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { AutoReviewMode, Bot } from "@shared/store/types";

export function BotSettings({ bot }: { readonly bot: Bot }) {
  const router = useRouter();
  const { state, refresh } = useAppState();
  const [name, setName] = useState(bot.name);
  const [job, setJob] = useState(bot.job);
  const [description, setDescription] = useState(bot.description);
  const [instructions, setInstructions] = useState(bot.instructions);
  const [autoReview, setAutoReview] = useState<AutoReviewMode>(bot.autoReview);
  const [autonomous, setAutonomous] = useState(bot.autonomous);
  const [peers, setPeers] = useState<string[]>(bot.allowedPeers);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | undefined>(bot.shareId ? `/b/${bot.shareId}` : undefined);
  const [copied, setCopied] = useState(false);
  const others = state.bots.filter((b) => b.id !== bot.id);

  async function save() {
    setSaving(true);
    await api(`/api/bots/${bot.id}`, {
      method: "PATCH",
      json: { name, job, description, instructions, autoReview, autonomous, allowedPeers: peers },
    });
    await refresh();
    setSaving(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  async function share() {
    const { url } = await api<{ url: string }>(`/api/bots/${bot.id}/share`, { method: "POST" });
    setShareUrl(url);
  }

  async function remove() {
    if (!window.confirm(`Delete ${bot.name}? Its memory and routines are deleted too.`)) return;
    await api(`/api/bots/${bot.id}`, { method: "DELETE" });
    await refresh();
    router.push("/app");
  }

  return (
    <AppPage>
      <Link className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-neutral-500 hover:text-white" href={`/app/bots/${bot.id}`}>
        <ArrowLeftIcon className="size-4" /> Back to {bot.name}
      </Link>
      <AppHeader
        actions={
          <button className={buttonPrimary} disabled={saving} onClick={save} type="button">
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : saved ? <CheckIcon className="size-4" /> : null}
            {saved ? "Saved" : "Save changes"}
          </button>
        }
        title={`${bot.name} settings`}
      />
      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-4">
            <BotAvatar color={bot.color} emoji={bot.emoji} size="lg" />
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <input className={inputClass} onChange={(e) => setName(e.target.value)} value={name} />
              <input className={inputClass} onChange={(e) => setJob(e.target.value)} value={job} />
            </div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-[13px] text-neutral-400">What it owns</span>
            <textarea className={cn(inputClass, "min-h-20")} onChange={(e) => setDescription(e.target.value)} value={description} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[13px] text-neutral-400">Operating instructions</span>
            <textarea className={cn(inputClass, "min-h-48 font-mono text-[12.5px] leading-relaxed")} onChange={(e) => setInstructions(e.target.value)} value={instructions} />
          </label>
        </Card>

        <Card className="space-y-3 p-5">
          <div className="text-[14px] text-white">Auto Review</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                ["auto", "Auto Review", "Reviewer model asks you only when an action is risky."],
                ["always", "Always ask", "Every sensitive action and desktop click waits for you."],
                ["off", "Trust it", "Sensitive actions run without asking."],
              ] as const
            ).map(([value, label, desc]) => (
              <button
                className={cn("rounded-2xl border p-3 text-left", autoReview === value ? "border-white/30 bg-white/[0.06]" : "border-white/[0.06] hover:border-white/15")}
                key={value}
                onClick={() => setAutoReview(value)}
                type="button"
              >
                <div className="text-[13.5px] text-white">{label}</div>
                <div className="text-[12px] text-neutral-500">{desc}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <label className="flex items-start gap-3">
            <input checked={autonomous} className="mt-1 accent-white" onChange={(e) => setAutonomous(e.target.checked)} type="checkbox" />
            <span>
              <span className="block text-[14px] text-white">Autonomous teammate messaging</span>
              <span className="block text-[12.5px] text-neutral-500">
                Lets {bot.name} message other bots on its own, including from scheduled routines and while working for a teammate.
              </span>
            </span>
          </label>
          {others.length > 0 ? (
            <div className="space-y-2">
              <div className="text-[13px] text-neutral-400">Who {bot.name} can message {peers.length === 0 ? "(everyone)" : ""}</div>
              <div className="flex flex-wrap gap-2">
                {others.map((o) => {
                  const on = peers.length === 0 || peers.includes(o.id);
                  return (
                    <button
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-[12.5px]",
                        on ? "border-white/25 text-white" : "border-white/[0.06] text-neutral-500",
                      )}
                      key={o.id}
                      onClick={() => {
                        const base = peers.length === 0 ? others.map((x) => x.id) : peers;
                        const next = base.includes(o.id) ? base.filter((x) => x !== o.id) : [...base, o.id];
                        setPeers(next.length === others.length ? [] : next);
                      }}
                      type="button"
                    >
                      <BotAvatar color={o.color} emoji={o.emoji} size="xs" />
                      {o.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div>
            <div className="text-[14px] text-white">Share {bot.name}</div>
            <div className="text-[12.5px] text-neutral-500">Publish a page anyone can use to add a copy of this bot and its routines.</div>
          </div>
          {shareUrl ? (
            <div className="flex items-center gap-2">
              <Link className="font-mono text-[12.5px] text-neutral-300 hover:text-white" href={shareUrl} target="_blank">
                {shareUrl}
              </Link>
              <button
                className={buttonSecondary}
                onClick={async () => {
                  await navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1200);
                }}
                type="button"
              >
                {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              </button>
              <button className={buttonSecondary} onClick={share} type="button">
                Update
              </button>
            </div>
          ) : (
            <button className={buttonSecondary} onClick={share} type="button">
              <Share2Icon className="size-4" /> Publish
            </button>
          )}
        </Card>

        <Card className="flex items-center justify-between gap-4 border-red-500/20 p-5">
          <div>
            <div className="text-[14px] text-white">Delete {bot.name}</div>
            <div className="text-[12.5px] text-neutral-500">Removes the bot, its memory, and its routines.</div>
          </div>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-500/40 px-4 text-[13px] text-red-300 hover:bg-red-500/10" onClick={remove} type="button">
            <Trash2Icon className="size-4" /> Delete
          </button>
        </Card>
      </div>
    </AppPage>
  );
}
