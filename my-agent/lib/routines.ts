import { deliverToBot } from "./delivery";
import { formatRoutineMessage } from "./protocol";
import { finishRoutineRun, getOwnedBot, startRoutineRun } from "./store/repo";
import type { Routine, RoutineRun } from "./store/types";

/**
 * Starts one run of a routine. The run arrives in the owning Bot's
 * conversation as a new message, so the result shows up in that chat.
 */
export async function runRoutine(routine: Routine, trigger: RoutineRun["trigger"], payload?: string): Promise<RoutineRun | null> {
  const bot = await getOwnedBot(routine.userId, routine.botId);
  if (!bot) return null;
  const run = await startRoutineRun(routine.id, trigger);
  if (!run) return null;
  try {
    await deliverToBot(bot.id, {
      text: formatRoutineMessage({ routineId: routine.id, runId: run.id, name: routine.name, trigger }, routine.instruction, payload),
      claims: { src: "routine", rtn: routine.id, run: run.id },
      dedupeKey: `routine-run:${run.id}`,
    });
  } catch (error) {
    await finishRoutineRun(routine.id, run.id, "failed");
    throw error;
  }
  return run;
}
