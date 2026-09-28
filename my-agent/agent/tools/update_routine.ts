import { defineTool } from "eve/tools";
import { z } from "zod";
import { describeSchedule } from "../../lib/schedule";
import { getRoutine, getUser, updateRoutine } from "../../lib/store/repo";
import { requireIdentity } from "../lib/identity";
import { scheduleSchema } from "../lib/routine-schema";

export default defineTool({
  description: "Change one of your routines: its name, instruction, schedule, or whether it is active.",
  inputSchema: z.object({
    id: z.string(),
    name: z.string().min(3).max(80).optional(),
    instruction: z.string().min(10).max(8000).optional(),
    schedule: scheduleSchema.optional(),
    enabled: z.boolean().optional().describe("false pauses the routine; true resumes it."),
  }),
  label: { start: () => "Updating routine" },
  async execute({ id, schedule, ...patch }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const existing = await getRoutine(id);
    if (!existing || existing.userId !== identity.userId || existing.botId !== identity.botId) {
      throw new Error("That routine isn't yours. Each routine belongs to one Bot.");
    }
    const user = await getUser(identity.userId);
    const next = await updateRoutine(identity.userId, id, {
      ...patch,
      ...(schedule
        ? {
            schedule: {
              everyMinutes: schedule.everyMinutes ?? null,
              at: schedule.at ?? null,
              days: schedule.days ?? null,
              timezone: user?.timezone ?? "UTC",
            },
          }
        : {}),
    });
    if (!next) throw new Error("Routine not found.");
    return { id: next.id, active: next.enabled, schedule: describeSchedule(next.schedule), nextRunAt: next.nextRunAt };
  },
});
