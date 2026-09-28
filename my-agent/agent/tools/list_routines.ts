import { defineTool } from "eve/tools";
import { z } from "zod";
import { describeSchedule } from "../../lib/schedule";
import { listRoutines } from "../../lib/store/repo";
import { requireIdentity } from "../lib/identity";

export default defineTool({
  description: "List your routines with their schedules, next run, and recent results.",
  inputSchema: z.object({}),
  label: { start: () => "Checking routines" },
  async execute(_input, ctx) {
    const identity = await requireIdentity(ctx.session);
    const routines = await listRoutines(identity.userId, identity.botId);
    return routines.map((r) => ({
      id: r.id,
      name: r.name,
      active: r.enabled,
      schedule: describeSchedule(r.schedule),
      nextRunAt: r.nextRunAt,
      lastRun: r.runs[0] ?? null,
      instruction: r.instruction,
    }));
  },
});
