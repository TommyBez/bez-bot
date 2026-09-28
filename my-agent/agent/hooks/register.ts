import { defineHook } from "eve/hooks";
import { registerSession } from "../../lib/store/repo";

/**
 * Backstop for the session registry. The app registers each Bot's
 * conversation when it creates it; this covers sessions started any other way.
 */
export default defineHook({
  events: {
    async "session.started"(_event, ctx) {
      const a = (ctx.session.auth.initiator?.attributes ?? {}) as Record<string, string>;
      if (!a.userId || !a.botId) return;
      await registerSession({
        sessionId: ctx.session.id,
        userId: a.userId,
        botId: a.botId,
        kind: a.kind === "group" ? "group" : "bot",
        groupId: a.groupId,
      });
    },
  },
});
