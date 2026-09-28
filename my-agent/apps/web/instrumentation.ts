/**
 * `eve dev` never fires schedules on their cron cadence, so in development we
 * tick the routine dispatcher once a minute through eve's dev dispatch route.
 * Production uses the Vercel Cron Job eve generates from the schedule.
 */
export async function register() {
  if (process.env.NODE_ENV !== "development" || process.env.BEZBOT_DEV_TICK === "0") return;
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;
  const globalKey = "__bezbotDevTicker";
  const g = globalThis as unknown as Record<string, unknown>;
  if (g[globalKey]) return;
  const port = process.env.PORT ?? "3000";
  g[globalKey] = setInterval(() => {
    fetch(`http://127.0.0.1:${port}/eve/v1/dev/schedules/dispatch`, { method: "POST" }).catch(() => undefined);
  }, 60_000);
}
