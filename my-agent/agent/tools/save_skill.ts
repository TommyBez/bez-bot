import { defineTool } from "eve/tools";
import { z } from "zod";
import { saveSkill } from "../../lib/store/repo";
import { requireIdentity } from "../lib/identity";

export default defineTool({
  description:
    "Save a reusable skill to the library every Bot shares: when to use it, required inputs and access, the steps, how to validate, what to return, and what needs approval. Saving an existing name replaces it. Use draft: true for a skill learned from a recording that the user should review.",
  inputSchema: z.object({
    name: z.string().min(3).max(80),
    description: z.string().min(3).max(300).describe("When to use it, in one sentence."),
    body: z.string().min(20).max(12000).describe("The instructions, as markdown."),
    draft: z.boolean().default(false),
  }),
  label: { start: ({ name }: { name: string }) => `Saving skill “${name}”` },
  async execute({ name, description, body, draft }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const skill = await saveSkill(identity.userId, {
      name,
      description,
      body,
      draft,
      source: draft ? "taught" : "chat",
      createdByBotId: identity.botId,
    });
    return { saved: true, slug: `/${skill.slug}`, draft: skill.draft };
  },
});
