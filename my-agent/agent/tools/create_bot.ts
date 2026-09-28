import { defineTool } from "eve/tools";
import { z } from "zod";
import { createBot, getUser } from "../../lib/store/repo";
import { sensitiveApproval } from "../lib/approval";
import { requireIdentity } from "../lib/identity";

export default defineTool({
  description:
    "Create a focused teammate Bot when a job deserves its own long-lived owner. It appears in the user's sidebar with its own conversation. Afterwards, brief it with message_bot.",
  inputSchema: z.object({
    name: z.string().min(2).max(40).describe("Short name, e.g. 'Churn Watch'."),
    label: z.string().max(80).default("").describe("One primary job, e.g. 'Flag at-risk accounts every morning'."),
    description: z.string().max(4000).describe("Its job and standing rules."),
    emoji: z.string().max(4).optional(),
  }),
  approval: sensitiveApproval,
  label: { start: ({ name }: { name: string }) => `Creating ${name}` },
  async execute({ name, label, description, emoji }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const user = await getUser(identity.userId);
    const bot = await createBot(
      identity.userId,
      { name, label, description, emoji, createdByBotId: identity.botId },
      user?.timezone ?? "UTC",
    );
    return { created: true, id: bot.id, name: bot.name, note: `${bot.name} is in the sidebar. Message them with message_bot to hand off work.` };
  },
});
