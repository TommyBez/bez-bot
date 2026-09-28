import { defineTool } from "eve/tools";
import { z } from "zod";
import { deleteRoutine } from "../../../lib/store/repo";
import { destructiveApproval } from "../approval";
import { requireIdentity } from "../identity";

export default defineTool({
  description: "Permanently delete a routine.",
  inputSchema: z.object({ id: z.string() }),
  approval: destructiveApproval,
  label: { start: () => "Deleting routine" },
  async execute({ id }, ctx) {
    const identity = await requireIdentity(ctx.session);
    return { deleted: await deleteRoutine(identity.userId, id) };
  },
});
