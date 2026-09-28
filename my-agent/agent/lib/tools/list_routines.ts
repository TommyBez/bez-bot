import { defineTool } from "eve/tools";
import { z } from "zod";
import { describeSchedule } from "../../../lib/schedule";
import { listBots, listRoutines } from "../../../lib/store/repo";
import { requireIdentity } from "../identity";

export default defineTool({
  description: "List routines for you or for the whole team, with schedules and last run status.",
  inputSchema: z.object({ scope: z.enum(["self", "team"]).default("self") }),
  label: { start: () => "Checking routines" },
  async execute({ scope }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const [routines, bots] = await Promise.all([
      listRoutines(identity.userId, scope === "self" ? identity.botId : undefined),
      listBots(identity.userId),
    ]);
    return routines.map((r) => ({
      id: r.id,
      bot: bots.find((b) => b.id === r.botId)?.name ?? r.botId,
      name: r.name,
      enabled: r.enabled,
      schedule: describeSchedule(r.schedule),
      nextRunAt: r.nextRunAt,
      lastRunAt: r.lastRunAt ?? null,
      lastStatus: r.lastStatus ?? null,
      steps: r.steps,
    }));
  },
});
