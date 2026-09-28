"use client";

import { cn } from "@/lib/utils";
import { inputClass } from "./page-header";

export interface ScheduleValue {
  kind: "none" | "daily" | "interval";
  at: string;
  days: number[];
  everyMinutes: number;
}

export function scheduleToPayload(value: ScheduleValue) {
  if (value.kind === "daily") return { at: value.at, days: value.days.length === 7 ? null : value.days, everyMinutes: null };
  if (value.kind === "interval") return { everyMinutes: value.everyMinutes, at: null, days: null };
  return null;
}

export function scheduleFromRoutine(schedule: { at?: string | null; days?: number[] | null; everyMinutes: number | null } | null): ScheduleValue {
  if (schedule?.at) return { kind: "daily", at: schedule.at, days: schedule.days ?? [0, 1, 2, 3, 4, 5, 6], everyMinutes: 60 };
  if (schedule?.everyMinutes) return { kind: "interval", at: "09:00", days: [1, 2, 3, 4, 5], everyMinutes: schedule.everyMinutes };
  return { kind: "none", at: "09:00", days: [1, 2, 3, 4, 5], everyMinutes: 60 };
}

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function ScheduleEditor({ value, onChange }: { readonly value: ScheduleValue; readonly onChange: (v: ScheduleValue) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["none", "On demand"],
            ["daily", "At a time"],
            ["interval", "Every…"],
          ] as const
        ).map(([kind, label]) => (
          <button
            className={cn(
              "rounded-full border px-3 py-1 text-[12.5px]",
              value.kind === kind ? "border-white/30 bg-white/[0.08] text-white" : "border-white/[0.08] text-neutral-400 hover:text-white",
            )}
            key={kind}
            onClick={() => onChange({ ...value, kind })}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {value.kind === "daily" ? (
        <div className="flex flex-wrap items-center gap-3">
          <input className={cn(inputClass, "w-32")} onChange={(e) => onChange({ ...value, at: e.target.value })} type="time" value={value.at} />
          <div className="flex gap-1">
            {DAYS.map((d, i) => (
              <button
                className={cn(
                  "size-8 rounded-full text-[12px]",
                  value.days.includes(i) ? "bg-white text-black" : "border border-white/10 text-neutral-500",
                )}
                key={i}
                onClick={() =>
                  onChange({ ...value, days: value.days.includes(i) ? value.days.filter((x) => x !== i) : [...value.days, i].sort() })
                }
                type="button"
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {value.kind === "interval" ? (
        <select
          className={cn(inputClass, "w-48")}
          onChange={(e) => onChange({ ...value, everyMinutes: Number(e.target.value) })}
          value={value.everyMinutes}
        >
          {[15, 30, 60, 120, 240, 480, 720, 1440].map((m) => (
            <option key={m} value={m}>
              {m < 60 ? `${m} minutes` : m === 60 ? "hour" : m === 1440 ? "day" : `${m / 60} hours`}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
