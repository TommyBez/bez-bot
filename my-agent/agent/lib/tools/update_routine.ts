import { defineTool } from "eve/tools";
import { z } from "zod";
import { describeSchedule } from "../../../lib/schedule";
import { getRoutine, getUser, updateRoutine } from "../../../lib/store/repo";
import { requireIdentity } from "../identity";
import { scheduleSchema } from "./routine-schema";

export default defineTool({
  description: "Change one of your routines: its steps, schedule, or whether it is enabled. Pass schedule null to make it on-demand.",
  inputSchema: z.object({
    id: z.string(),
    name: z.string().min(3).max(80).optional(),
    description: z.string().max(400).optional(),
    steps: z.string().min(10).max(8000).optional(),
    schedule: scheduleSchema.nullable().optional(),
    enabled: z.boolean().optional(),
  }),
  label: { start: () => "Updating routine" },
  async execute({ id, schedule, ...patch }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const existing = await getRoutine(id);
    if (!existing || existing.userId !== identity.userId) throw new Error("Unknown routine.");
    const user = await getUser(identity.userId);
    const timezone = user?.timezone ?? "UTC";
    const next = await updateRoutine(identity.userId, id, {
      ...patch,
      ...(schedule === undefined
        ? {}
        : {
            schedule:
              schedule && (schedule.at || schedule.everyMinutes)
                ? { everyMinutes: schedule.everyMinutes ?? null, at: schedule.at ?? null, days: schedule.days ?? null, timezone }
                : null,
          }),
    });
    if (!next) throw new Error("Routine not found.");
    return { id: next.id, enabled: next.enabled, schedule: describeSchedule(next.schedule), nextRunAt: next.nextRunAt };
  },
});
