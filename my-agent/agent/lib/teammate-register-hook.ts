import { defineHook } from "eve/hooks";
import { parseTeammateEnvelope } from "../../lib/protocol";
import { registerSession, updateExchange } from "../../lib/store/repo";

/**
 * Registers each teammate session under the bot named in its envelope, so
 * tools, route auth, and the app can attribute the work to the right bot.
 */
export default defineHook({
  events: {
    async "message.received"(event, ctx) {
      if (event.data.kind === "execution.background_task") return;
      const envelope = parseTeammateEnvelope(event.data.message);
      if (!envelope) return;
      await registerSession(
        {
          sessionId: ctx.session.id,
          userId: envelope.userId,
          botId: envelope.botId,
          mode: "teammate",
          threadId: envelope.threadId,
          exchangeId: envelope.exchangeId,
          fromBotId: envelope.fromBotId,
          rootSessionId: ctx.session.parent?.rootSessionId,
          depth: envelope.depth,
        },
        { upsert: true },
      );
      await updateExchange(envelope.exchangeId, { agentId: ctx.session.id });
    },
  },
});
