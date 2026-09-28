"use client";

import { CrownIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppState } from "@/components/app/app-state";
import { AppHeader, AppPage, buttonPrimary, Card, EmptyState, inputClass } from "@/components/app/page-header";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Thread } from "@shared/store/types";

export default function NewThreadPage() {
  const router = useRouter();
  const { state, refresh } = useAppState();
  const [title, setTitle] = useState("");
  const [members, setMembers] = useState<string[]>(state.bots.slice(0, 3).map((b) => b.id));
  const [lead, setLead] = useState<string | undefined>(state.bots.find((b) => b.templateId === "chief-of-staff")?.id);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const effectiveLead = lead && members.includes(lead) ? lead : members[0];

  if (state.bots.length === 0) {
    return (
      <AppPage>
        <AppHeader title="New thread" />
        <EmptyState
          action={
            <Link className={buttonPrimary} href="/app/bots/new">
              Create a bot
            </Link>
          }
          body="Threads put several bots in one conversation so they can pass work between themselves."
          title="Create a couple of bots first"
        />
      </AppPage>
    );
  }

  async function create() {
    setPending(true);
    setError(undefined);
    try {
      const { thread } = await api<{ thread: Thread }>("/api/threads", {
        method: "POST",
        json: { title: title || undefined, memberBotIds: members, leadBotId: effectiveLead },
      });
      await refresh();
      router.push(`/app/threads/${thread.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the thread.");
      setPending(false);
    }
  }

  return (
    <AppPage>
      <AppHeader body="Put a few Bots in the same thread and they pass work between themselves." title="Connect the Bots" />
      <Card className="space-y-5 p-5">
        <label className="block space-y-1.5">
          <span className="text-[13px] text-neutral-400">Thread name</span>
          <input className={inputClass} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. q3-launch" value={title} />
        </label>
        <div className="space-y-2">
          <span className="text-[13px] text-neutral-400">Bots in this thread · the crown marks the lead who coordinates</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {state.bots.map((bot) => {
              const selected = members.includes(bot.id);
              return (
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors",
                    selected ? "border-white/25 bg-white/[0.05]" : "border-white/[0.06]",
                  )}
                  key={bot.id}
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => setMembers((m) => (m.includes(bot.id) ? m.filter((x) => x !== bot.id) : [...m, bot.id]))}
                    type="button"
                  >
                    <input checked={selected} className="accent-white" readOnly type="checkbox" />
                    <BotAvatar color={bot.color} emoji={bot.emoji} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] text-white">{bot.name}</span>
                      <span className="block truncate text-[12px] text-neutral-500">{bot.job}</span>
                    </span>
                  </button>
                  {selected ? (
                    <button
                      aria-label={`Make ${bot.name} the lead`}
                      className={cn("rounded-full p-1.5", effectiveLead === bot.id ? "text-amber-300" : "text-neutral-600 hover:text-neutral-300")}
                      onClick={() => setLead(bot.id)}
                      type="button"
                    >
                      <CrownIcon className="size-4" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
        <button className={cn(buttonPrimary, "h-10")} disabled={pending || members.length === 0} onClick={create} type="button">
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Create thread
        </button>
      </Card>
    </AppPage>
  );
}
