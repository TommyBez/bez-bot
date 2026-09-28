import { defineTool } from "eve/tools";
import { z } from "zod";
import { addMemory, getBot, pushInbox, TEAM_MEMORY } from "../../../lib/store/repo";
import { requireIdentity } from "../identity";

export default defineTool({
  description:
    "Save a durable fact or preference to memory so you (scope 'self') or every bot on the team (scope 'team') remember it in future tasks. Never save secrets.",
  inputSchema: z.object({
    text: z.string().min(3).max(1200).describe("One self-contained fact, e.g. 'Acme only signs annual contracts; Dana approves.'"),
    scope: z.enum(["self", "team"]).default("self"),
  }),
  label: { start: ({ scope }) => (scope === "team" ? "Updating team memory" : "Updating memory") },
  async execute({ text, scope }, ctx) {
    const identity = await requireIdentity(ctx.session);
    if (/(password|passcode|api[_ -]?key|secret|token|otp)\s*[:=]/i.test(text)) {
      throw new Error("That looks like a credential. Ask the user to add it under Settings → Logins instead.");
    }
    const target = scope === "team" ? TEAM_MEMORY : identity.botId;
    const entry = await addMemory(identity.userId, target, {
      text,
      source: identity.mode === "teammate" ? "teammate" : "bot",
      authorBotId: identity.botId,
    });
    const bot = await getBot(identity.botId);
    await pushInbox({
      userId: identity.userId,
      botId: identity.botId,
      kind: "memory",
      title: `Updated memory for ${scope === "team" ? "the team" : (bot?.name ?? "a bot")}`,
      body: text,
      href: "/app/memory",
    });
    return { saved: true, id: entry?.id, scope };
  },
});
