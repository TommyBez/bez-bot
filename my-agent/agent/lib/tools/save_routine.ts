import { defineTool } from "eve/tools";
import { z } from "zod";
import { describeSchedule } from "../../../lib/schedule";
import { createRoutine, getUser, pushInbox } from "../../../lib/store/repo";
import { requireIdentity } from "../identity";
import { scheduleSchema } from "./routine-schema";

export default defineTool({
  description:
    "Save a repeatable workflow as a routine so you can run it on your own next time, on demand or on a schedule. Write steps precisely enough that you could follow them without the user.",
  inputSchema: z.object({
    name: z.string().min(3).max(80),
    description: z.string().max(400).default(""),
    steps: z.string().min(10).max(8000).describe("Numbered steps: apps, pages, inputs, decisions, outputs."),
    schedule: scheduleSchema.optional(),
    enabled: z.boolean().default(true).describe("Whether the schedule is active right away."),
    source: z.enum(["taught", "bot"]).default("bot"),
  }),
  label: { start: ({ name }) => `Saving routine “${name}”` },
  async execute({ name, description, steps, schedule, enabled, source }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const user = await getUser(identity.userId);
    const timezone = user?.timezone ?? "UTC";
    const hasSchedule = Boolean(schedule && (schedule.at || schedule.everyMinutes));
    const routine = await createRoutine(identity.userId, {
      botId: identity.botId,
      name,
      description,
      steps,
      source: identity.mode === "teach" ? "taught" : source,
      schedule: hasSchedule
        ? { everyMinutes: schedule?.everyMinutes ?? null, at: schedule?.at ?? null, days: schedule?.days ?? null, timezone }
        : null,
      enabled,
    });
    await pushInbox({
      userId: identity.userId,
      botId: identity.botId,
      kind: "routine",
      title: `New routine: ${routine.name}`,
      body: describeSchedule(routine.schedule),
      href: `/app/routines/${routine.id}`,
    });
    return {
      id: routine.id,
      name: routine.name,
      schedule: describeSchedule(routine.schedule),
      nextRunAt: routine.nextRunAt,
    };
  },
});
