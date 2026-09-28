import { defineTool } from "eve/tools";
import { z } from "zod";
import { describeSchedule } from "../../lib/schedule";
import { createRoutine, getUser } from "../../lib/store/repo";
import { requireIdentity } from "../lib/identity";
import { scheduleSchema } from "../lib/routine-schema";

export default defineTool({
  description:
    "Create a routine: a workflow you run on a schedule. Each run arrives in your conversation and you post the result there. Write the instruction precisely enough that you could follow it without the user.",
  inputSchema: z.object({
    name: z.string().min(3).max(80),
    instruction: z.string().min(10).max(8000).describe("What to do on each run: sources, steps, the result to post, and the approval boundary."),
    schedule: scheduleSchema,
  }),
  label: { start: ({ name }) => `Creating routine “${name}”` },
  async execute({ name, instruction, schedule }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const user = await getUser(identity.userId);
    const routine = await createRoutine(identity.userId, {
      botId: identity.botId,
      name,
      instruction,
      source: "chat",
      schedule: {
        everyMinutes: schedule.everyMinutes ?? null,
        at: schedule.at ?? null,
        days: schedule.days ?? null,
        timezone: user?.timezone ?? "UTC",
      },
      enabled: true,
    });
    return {
      id: routine.id,
      name: routine.name,
      schedule: describeSchedule(routine.schedule),
      nextRunAt: routine.nextRunAt,
      timezone: routine.schedule?.timezone,
    };
  },
});
