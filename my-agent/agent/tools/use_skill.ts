import { defineTool } from "eve/tools";
import { z } from "zod";
import { getSkill } from "../../lib/store/repo";
import { requireIdentity } from "../lib/identity";

export default defineTool({
  description: "Load a skill from the shared library by its /slug or name, then follow its instructions.",
  inputSchema: z.object({ name: z.string().min(1).describe("Skill slug like '/weekly-report' or its name.") }),
  label: { start: ({ name }: { name: string }) => `Loading skill ${name.startsWith("/") ? name : `/${name}`}` },
  async execute({ name }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const skill = await getSkill(identity.userId, name);
    if (!skill) return { found: false, error: `No skill called ${name}.` };
    return { found: true, slug: `/${skill.slug}`, name: skill.name, draft: skill.draft, instructions: skill.body };
  },
});
