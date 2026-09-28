import type { RoutineSchedule } from "./store/types";

/** Offset in minutes of `timeZone` relative to UTC at `date`. */
function tzOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(year, month, day, hour, minute));
  const offset = tzOffsetMinutes(guess, timeZone);
  const result = new Date(guess.getTime() - offset * 60_000);
  // Correct across DST boundaries.
  const offset2 = tzOffsetMinutes(result, timeZone);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2 * 60_000);
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(get("year")),
    month: Number(get("month")) - 1,
    day: Number(get("day")),
    weekday: weekdays.indexOf(get("weekday")),
  };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Next run strictly after `from`. Daily-clock schedules (`at`) take
 * precedence over intervals; `null` means the routine only runs on demand.
 */
export function computeNextRun(schedule: RoutineSchedule | null, from: Date = new Date()): Date | null {
  if (!schedule) return null;
  const timeZone = isValidTimeZone(schedule.timezone) ? schedule.timezone : "UTC";
  if (schedule.at) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(schedule.at);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const days = schedule.days && schedule.days.length > 0 ? schedule.days : [0, 1, 2, 3, 4, 5, 6];
    for (let offset = 0; offset < 9; offset += 1) {
      const probe = new Date(from.getTime() + offset * 86_400_000);
      const { year, month, day, weekday } = zonedParts(probe, timeZone);
      if (!days.includes(weekday)) continue;
      const candidate = zonedToUtc(year, month, day, hour, minute, timeZone);
      if (candidate.getTime() > from.getTime()) return candidate;
    }
    return null;
  }
  if (schedule.everyMinutes && schedule.everyMinutes > 0) {
    return new Date(from.getTime() + schedule.everyMinutes * 60_000);
  }
  return null;
}

export function describeSchedule(schedule: RoutineSchedule | null): string {
  if (!schedule) return "On demand";
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (schedule.at) {
    const days = schedule.days && schedule.days.length > 0 && schedule.days.length < 7
      ? schedule.days.map((d) => dayNames[d]).join(", ")
      : "Every day";
    const weekdays = schedule.days?.length === 5 && [1, 2, 3, 4, 5].every((d) => schedule.days?.includes(d));
    return `${weekdays ? "Weekdays" : days} at ${schedule.at} (${schedule.timezone})`;
  }
  if (schedule.everyMinutes) {
    const m = schedule.everyMinutes;
    if (m % 1440 === 0) return m === 1440 ? "Every day" : `Every ${m / 1440} days`;
    if (m % 60 === 0) return m === 60 ? "Every hour" : `Every ${m / 60} hours`;
    return `Every ${m} minutes`;
  }
  return "On demand";
}
