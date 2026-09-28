import { defineTool } from "eve/tools";
import { z } from "zod";
import { deleteRoutine, getRoutine } from "../../lib/store/repo";
import { destructiveApproval } from "../lib/approval";
import { requireIdentity } from "../lib/identity";

export default defineTool({
  description: "Permanently delete one of your routines. This can't be undone.",
  inputSchema: z.object({ id: z.string() }),
  approval: destructiveApproval,
  label: { start: () => "Deleting routine" },
  async execute({ id }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const routine = await getRoutine(id);
    if (!routine || routine.userId !== identity.userId || routine.botId !== identity.botId) {
      throw new Error("That routine isn't yours.");
    }
    return { deleted: await deleteRoutine(identity.userId, id), name: routine.name };
  },
});
