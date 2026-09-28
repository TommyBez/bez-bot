import { defineTool } from "eve/tools";
import { z } from "zod";
import { addMemory } from "../../lib/store/repo";
import { requireIdentity } from "../lib/identity";

export default defineTool({
  description:
    "Save a durable fact or preference to your memory so you remember it in future work. Never save secrets.",
  inputSchema: z.object({
    text: z.string().min(3).max(1200).describe("One self-contained fact, e.g. 'Acme only signs annual contracts; Dana approves.'"),
  }),
  label: { start: () => "Updating memory" },
  async execute({ text }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const entry = await addMemory(identity.userId, identity.botId, { text, source: "bot" });
    return entry ? { saved: true, id: entry.id, text: entry.text } : { saved: false };
  },
});
