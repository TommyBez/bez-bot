import { defineTool } from "eve/tools";
import { z } from "zod";
import { removeMemory, TEAM_MEMORY } from "../../../lib/store/repo";
import { requireIdentity } from "../identity";

export default defineTool({
  description: "Remove an outdated or wrong memory entry by its id (shown in brackets in your memory).",
  inputSchema: z.object({ id: z.string().min(3), scope: z.enum(["self", "team"]).default("self") }),
  label: { start: () => "Updating memory" },
  async execute({ id, scope }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const removed = await removeMemory(identity.userId, scope === "team" ? TEAM_MEMORY : identity.botId, id);
    return { removed };
  },
});
