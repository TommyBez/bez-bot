import { defineTool } from "eve/tools";
import { z } from "zod";
import { pushInbox } from "../../../lib/store/repo";
import { requireIdentity } from "../identity";

export default defineTool({
  description:
    "Send the user a notification in their Bez Bot inbox. Use it when work finishes while they are away, or when a decision or approval from them is needed.",
  inputSchema: z.object({
    title: z.string().min(3).max(140),
    body: z.string().max(4000).optional(),
    needsDecision: z.boolean().default(false),
  }),
  label: { start: ({ title }) => `Notifying: ${title}` },
  async execute({ title, body, needsDecision }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const item = await pushInbox({
      userId: identity.userId,
      botId: identity.botId,
      kind: needsDecision ? "question" : "done",
      title,
      body,
      sessionId: ctx.session.id,
      href: identity.conversationId
        ? `/app/bots/${identity.botId}/c/${identity.conversationId}`
        : identity.threadId
          ? `/app/threads/${identity.threadId}`
          : `/app/bots/${identity.botId}`,
    });
    return { delivered: true, id: item.id };
  },
});
