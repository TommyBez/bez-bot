import { defineChannel, GET } from "eve/channels";

export interface RoutineTarget {
  routineId: string;
  /** Unique per run so each run gets a fresh durable session. */
  runKey: string;
}

/**
 * Headless channel for scheduled routine runs. The dispatcher schedule hands
 * work here with `to(routines, target).send(...)`. Results reach people
 * through the inbox and bot status rather than a reply on this channel.
 */
export default defineChannel<undefined, void, RoutineTarget>({
  routes: [GET("/bezbot/routines/health", async () => Response.json({ ok: true, channel: "routines" }))],
  async receive({ message, target, auth }, { from }) {
    return from(`routine:${target.routineId}:${target.runKey}`).send(message, {
      auth,
      taskDeliveryPolicy: "cohort",
    });
  },
});
