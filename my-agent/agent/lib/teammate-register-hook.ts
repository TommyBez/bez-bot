import { defineHook } from "eve/hooks";
import { kv } from "../../lib/store/kv";
import { getSessionContext, registerSession, updateExchange } from "../../lib/store/repo";
import { verifiedTeammateEnvelope } from "./identity";

/**
 * Registers each teammate session under the bot named in its envelope, so
 * tools, route auth, and the app can attribute the work to the right bot.
 * Only signed envelopes count, and a session never moves to another user.
 */
export default defineHook({
  events: {
    async "message.received"(event, ctx) {
      if (event.data.kind === "execution.background_task") return;
      const envelope = verifiedTeammateEnvelope(event.data.message);
      if (!envelope) return;
      const existing = await getSessionContext(ctx.session.id);
      if (existing && existing.userId !== envelope.userId) return;
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
      const agentId = await kv().get<string>(`child-agent:${ctx.session.id}`);
      await updateExchange(envelope.exchangeId, { childSessionId: ctx.session.id, ...(agentId ? { agentId } : {}) });
    },
  },
});
