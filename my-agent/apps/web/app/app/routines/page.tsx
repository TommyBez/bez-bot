"use client";

import { Loader2Icon, PlayIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAppState } from "@/components/app/app-state";
import { AppHeader, AppPage, buttonGhost, buttonPrimary, buttonSecondary, Card, EmptyState, inputClass } from "@/components/app/page-header";
import { ScheduleEditor, scheduleToPayload, type ScheduleValue } from "@/components/app/schedule-editor";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api, timeAgo, usePoll } from "@/lib/client";
import { cn } from "@/lib/utils";
import { describeSchedule } from "@shared/schedule";
import type { Routine } from "@shared/store/types";

function StatusPill({ routine }: { readonly routine: Routine }) {
  const s = routine.lastStatus;
  const cls =
    s === "running" || s === "queued"
      ? "bg-emerald-400/10 text-emerald-300"
      : s === "failed"
        ? "bg-red-400/10 text-red-300"
        : s === "succeeded"
          ? "bg-white/[0.06] text-neutral-300"
          : "bg-white/[0.04] text-neutral-500";
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px]", cls)}>{s ?? "never run"}</span>;
}

export default function RoutinesPage() {
  const { state } = useAppState();
  const { data, refresh } = usePoll<{ routines: Routine[] }>("/api/routines", 5000);
  const [creating, setCreating] = useState(false);
  const [botId, setBotId] = useState(state.bots[0]?.id ?? "");
  const [name, setName] = useState("");
  const [steps, setSteps] = useState("");
  const [schedule, setSchedule] = useState<ScheduleValue>({ kind: "daily", at: "09:00", days: [1, 2, 3, 4, 5], everyMinutes: 60 });
  const [pending, setPending] = useState(false);
  const routines = data?.routines ?? [];

  async function toggle(r: Routine) {
    await api(`/api/routines/${r.id}`, { method: "PATCH", json: { enabled: !r.enabled } });
    await refresh();
  }

  async function runNow(r: Routine) {
    await api(`/api/routines/${r.id}`, { method: "PATCH", json: { runNow: true } });
    await refresh();
  }

  async function create() {
    setPending(true);
    try {
      await api("/api/routines", { method: "POST", json: { botId, name, steps, schedule: scheduleToPayload(schedule) } });
      setCreating(false);
      setName("");
      setSteps("");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <AppPage wide>
      <AppHeader
        actions={
          state.bots.length > 0 ? (
            <button className={buttonPrimary} onClick={() => setCreating((v) => !v)} type="button">
              <PlusIcon className="size-4" /> New routine
            </button>
          ) : null
        }
        body={`Work your bots run on their own. Times are in ${state.user.timezone ?? "UTC"}.`}
        title="Routines"
      />

      {creating ? (
        <Card className="mb-6 space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
            <select className={inputClass} onChange={(e) => setBotId(e.target.value)} value={botId}>
              {state.bots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.emoji} {b.name}
                </option>
              ))}
            </select>
            <input className={inputClass} onChange={(e) => setName(e.target.value)} placeholder="Routine name, e.g. Monday team brief" value={name} />
          </div>
          <textarea
            className={cn(inputClass, "min-h-32 font-mono text-[12.5px]")}
            onChange={(e) => setSteps(e.target.value)}
            placeholder={"1. Message every other bot for a status update\n2. Merge replies into a brief\n3. Save it to /workspace/shared/briefs/<date>.md"}
            value={steps}
          />
          <ScheduleEditor onChange={setSchedule} value={schedule} />
          <div className="flex gap-2">
            <button className={buttonPrimary} disabled={pending || !name.trim() || steps.trim().length < 5} onClick={create} type="button">
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : null} Save routine
            </button>
            <button className={buttonGhost} onClick={() => setCreating(false)} type="button">
              Cancel
            </button>
          </div>
          <p className="text-[12px] text-neutral-500">Tip: open a bot and use “Teach a task” to record the workflow instead of writing steps.</p>
        </Card>
      ) : null}

      {routines.length === 0 ? (
        <EmptyState
          action={
            state.bots[0] ? (
              <Link className={buttonSecondary} href={`/app/bots/${state.bots[0].id}`}>
                Teach {state.bots[0].name} a task
              </Link>
            ) : (
              <Link className={buttonSecondary} href="/app/bots/new">
                Create a bot
              </Link>
            )
          }
          body="Show a bot a workflow once and it saves it as a routine it can run on a schedule."
          title="No routines yet"
        />
      ) : (
        <div className="space-y-2">
          {routines.map((r) => {
            const bot = state.bots.find((b) => b.id === r.botId);
            return (
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" key={r.id}>
                <Link className="flex min-w-0 flex-1 items-center gap-3" href={`/app/routines/${r.id}`}>
                  <BotAvatar color={bot?.color} emoji={bot?.emoji} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14.5px] text-white">{r.name}</span>
                      <StatusPill routine={r} />
                    </div>
                    <div className="truncate text-[12.5px] text-neutral-500">
                      {bot?.name} · {r.enabled ? describeSchedule(r.schedule) : "Paused"}
                      {r.enabled && r.nextRunAt ? ` · next ${timeAgo(r.nextRunAt)}` : ""}
                      {r.lastRunAt ? ` · last ${timeAgo(r.lastRunAt)}` : ""}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <button className={buttonSecondary} onClick={() => void runNow(r)} type="button">
                    <PlayIcon className="size-3.5" /> Run now
                  </button>
                  <button
                    aria-pressed={r.enabled}
                    className={cn("relative h-6 w-11 rounded-full transition-colors", r.enabled ? "bg-white" : "bg-white/10")}
                    onClick={() => void toggle(r)}
                    type="button"
                  >
                    <span className={cn("absolute top-0.5 size-5 rounded-full transition-all", r.enabled ? "left-5.5 bg-black" : "left-0.5 bg-neutral-400")} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppPage>
  );
}
