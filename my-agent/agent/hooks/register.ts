import { defineHook } from "eve/hooks";
import { parseRoutineMarker, parseTeammateEnvelope } from "../../lib/protocol";
import {
  getThread,
  registerSession,
  touchConversationBySession,
  updateThread,
} from "../../lib/store/repo";
import { identityFromAuth } from "../lib/identity";

function titleFrom(message: string): string {
  const clean = message.replace(/<bezbot-[^>]+\/>/g, "").replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean || "New task";
}

/**
 * Records who each root session belongs to (user, bot, thread, routine) so
 * tools, the sandbox, route auth, and the app can find it by session id.
 */
export default defineHook({
  events: {
    async "session.started"(_event, ctx) {
      const identity = identityFromAuth(ctx.session.auth.initiator);
      if (!identity) return;
      await registerSession({
        sessionId: ctx.session.id,
        userId: identity.userId,
        botId: identity.botId,
        mode: identity.routineId ? "routine" : identity.mode,
        threadId: identity.threadId,
        conversationId: identity.conversationId,
        routineId: identity.routineId,
        depth: 0,
      });
      if (identity.threadId) {
        const thread = await getThread(identity.threadId);
        if (thread && !thread.sessionId) await updateThread(identity.userId, thread.id, { sessionId: ctx.session.id });
      }
    },
    async "message.received"(event, ctx) {
      if (event.data.kind === "execution.background_task") return;
      if (parseTeammateEnvelope(event.data.message) || parseRoutineMarker(event.data.message)) return;
      await touchConversationBySession(ctx.session.id, titleFrom(event.data.message));
    },
  },
});
