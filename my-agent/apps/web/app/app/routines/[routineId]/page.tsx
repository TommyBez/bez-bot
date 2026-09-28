"use client";

import { ArrowLeftIcon, CheckIcon, Loader2Icon, PlayIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppState } from "@/components/app/app-state";
import { SessionTranscript } from "@/components/app/chat/session-transcript";
import { AppHeader, AppPage, buttonPrimary, buttonSecondary, Card, inputClass } from "@/components/app/page-header";
import { ScheduleEditor, scheduleFromRoutine, scheduleToPayload, type ScheduleValue } from "@/components/app/schedule-editor";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api, timeAgo, usePoll } from "@/lib/client";
import { cn } from "@/lib/utils";
import { describeSchedule } from "@shared/schedule";
import type { Routine } from "@shared/store/types";

export default function RoutinePage() {
  const { routineId } = useParams<{ routineId: string }>();
  const router = useRouter();
  const { state } = useAppState();
  const { data, refresh } = usePoll<{ routine: Routine }>(`/api/routines/${routineId}`, 5000);
  const routine = data?.routine;
  const [name, setName] = useState("");
  const [steps, setSteps] = useState("");
  const [schedule, setSchedule] = useState<ScheduleValue>(scheduleFromRoutine(null));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (routine && !loaded) {
      setName(routine.name);
      setSteps(routine.steps);
      setSchedule(scheduleFromRoutine(routine.schedule));
      setLoaded(true);
    }
  }, [routine, loaded]);

  if (!routine) {
    return (
      <AppPage>
        <p className="shimmer-text text-[14px]">Loading routine…</p>
      </AppPage>
    );
  }
  const bot = state.bots.find((b) => b.id === routine.botId);

  async function save() {
    setSaving(true);
    await api(`/api/routines/${routineId}`, { method: "PATCH", json: { name, steps, schedule: scheduleToPayload(schedule) } });
    await refresh();
    setSaving(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <AppPage>
      <Link className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-neutral-500 hover:text-white" href="/app/routines">
        <ArrowLeftIcon className="size-4" /> Routines
      </Link>
      <AppHeader
        actions={
          <>
            <button
              className={buttonSecondary}
              onClick={async () => {
                await api(`/api/routines/${routineId}`, { method: "PATCH", json: { runNow: true } });
                await refresh();
              }}
              type="button"
            >
              <PlayIcon className="size-3.5" /> Run now
            </button>
            <button className={buttonPrimary} disabled={saving} onClick={save} type="button">
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : saved ? <CheckIcon className="size-4" /> : null}
              {saved ? "Saved" : "Save"}
            </button>
          </>
        }
        body={
          <span className="flex items-center gap-2">
            <BotAvatar color={bot?.color} emoji={bot?.emoji} size="xs" /> {bot?.name} · {routine.enabled ? describeSchedule(routine.schedule) : "Paused"} ·{" "}
            {routine.runCount} runs · source: {routine.source}
          </span>
        }
        title={routine.name}
      />
      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <input className={inputClass} onChange={(e) => setName(e.target.value)} value={name} />
          <textarea className={cn(inputClass, "min-h-56 font-mono text-[12.5px] leading-relaxed")} onChange={(e) => setSteps(e.target.value)} value={steps} />
          <ScheduleEditor onChange={setSchedule} value={schedule} />
          <div className="flex items-center justify-between text-[12.5px] text-neutral-500">
            <span>
              {routine.enabled ? (routine.nextRunAt ? `Next run ${timeAgo(routine.nextRunAt)}` : "No upcoming run") : "Paused"}
              {routine.lastRunAt ? ` · Last run ${timeAgo(routine.lastRunAt)} (${routine.lastStatus ?? "unknown"})` : ""}
            </span>
            <button
              className="inline-flex items-center gap-1.5 text-red-300/80 hover:text-red-300"
              onClick={async () => {
                if (!window.confirm("Delete this routine?")) return;
                await api(`/api/routines/${routineId}`, { method: "DELETE" });
                router.push("/app/routines");
              }}
              type="button"
            >
              <Trash2Icon className="size-3.5" /> Delete
            </button>
          </div>
        </Card>
        {routine.lastSessionId ? (
          <Card className="p-5">
            <div className="mb-4 text-[14px] text-white">Last run</div>
            <SessionTranscript botId={routine.botId} key={routine.lastSessionId} sessionId={routine.lastSessionId} />
          </Card>
        ) : null}
      </div>
    </AppPage>
  );
}
