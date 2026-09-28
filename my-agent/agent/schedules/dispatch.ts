import { defineSchedule } from "eve/schedules";
import { formatRoutinePrompt } from "../../lib/protocol";
import {
  claimDueRoutines,
  getOwnedBot,
  getUser,
  markRoutineStarted,
  pushInbox,
  releaseRoutine,
} from "../../lib/store/repo";
import routines from "../channels/routines";

/**
 * The only authored schedule. Every minute it leases routines whose next run
 * is due and starts one durable session per run on the headless `routines`
 * channel, running as the routine owner with the routine's bot persona.
 *
 * Bots can also start work on their own this way: a routine may message
 * teammates, so scheduled runs drive autonomous bot-to-bot collaboration.
 */
export default defineSchedule({
  cron: "* * * * *",
  run({ to, waitUntil }) {
    waitUntil(
      (async () => {
        const due = await claimDueRoutines({ limit: 25, leaseMs: 5 * 60_000 });
        await Promise.all(
          due.map(async (routine) => {
            try {
              const [user, bot] = await Promise.all([
                getUser(routine.userId),
                getOwnedBot(routine.userId, routine.botId),
              ]);
              if (!user || !bot) {
                await releaseRoutine(routine.id, new Date(Date.now() + 24 * 3600_000));
                return;
              }
              const trigger = routine.lastRunAt ? "schedule" : "manual";
              const session = await to(routines, {
                routineId: routine.id,
                runKey: `${Date.now()}`,
              }).send(formatRoutinePrompt(routine, trigger), {
                auth: {
                  authenticator: "bezbot-routine",
                  principalId: user.id,
                  principalType: "user",
                  attributes: {
                    userId: user.id,
                    name: user.name,
                    email: user.email,
                    botId: bot.id,
                    mode: "routine",
                    routineId: routine.id,
                  },
                },
                taskDeliveryPolicy: "cohort",
              });
              await markRoutineStarted(routine.id, session.id);
              await pushInbox({
                userId: user.id,
                botId: bot.id,
                kind: "routine",
                title: `${bot.name} started “${routine.name}”`,
                sessionId: session.id,
                href: `/app/routines/${routine.id}`,
              });
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
