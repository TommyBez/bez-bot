import { defineSchedule } from "eve/schedules";
import { runRoutine } from "../../lib/routines";
import { claimDueRoutines, releaseRoutine } from "../../lib/store/repo";

/**
 * The only authored schedule. Every minute it leases routines whose next run
 * is due and posts each run into its Bot's conversation. A routine can
 * message other Bots, so scheduled runs drive Bot-to-Bot work too.
 */
export default defineSchedule({
  cron: "* * * * *",
  run({ waitUntil }) {
    waitUntil(
      (async () => {
        const due = await claimDueRoutines({ limit: 25, leaseMs: 5 * 60_000 });
        await Promise.all(
          due.map(async (routine) => {
            try {
              const run = await runRoutine(routine, "schedule");
              if (!run) await releaseRoutine(routine.id, new Date(Date.now() + 24 * 3600_000));
            } catch (error) {
              console.error("[bezbot] routine dispatch failed", routine.id, error);
              await releaseRoutine(routine.id, new Date(Date.now() + 5 * 60_000));
            }
          }),
        );
      })(),
    );
  },
});
