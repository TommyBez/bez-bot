import { defineTool } from "eve/tools";
import { z } from "zod";
import { getRoutine, queueRoutineNow } from "../../../lib/store/repo";
import { requireIdentity } from "../identity";

export default defineTool({
  description:
    "Start one of the team's routines in the background right now. It runs in its own session as its bot and reports to the user's inbox.",
  inputSchema: z.object({ id: z.string() }),
  label: { start: () => "Queuing routine run" },
  async execute({ id }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const routine = await getRoutine(id);
    if (!routine || routine.userId !== identity.userId) throw new Error("Unknown routine.");
    await queueRoutineNow(identity.userId, id);
    return { queued: true, routine: routine.name, note: "The dispatcher starts queued runs within a minute." };
  },
});
