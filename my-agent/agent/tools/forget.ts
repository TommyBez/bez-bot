import { defineTool } from "eve/tools";
import { z } from "zod";
import { removeMemory } from "../../lib/store/repo";
import { requireIdentity } from "../lib/identity";

export default defineTool({
  description: "Remove an outdated or wrong memory entry by its id (shown in brackets in your memory).",
  inputSchema: z.object({ id: z.string().min(3) }),
  label: { start: () => "Updating memory" },
  async execute({ id }, ctx) {
    const identity = await requireIdentity(ctx.session);
    return { removed: await removeMemory(identity.userId, identity.botId, id) };
  },
});
