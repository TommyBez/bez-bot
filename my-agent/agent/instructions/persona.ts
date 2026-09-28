import { defineDynamic, defineInstructions } from "eve/instructions";
import { buildPersona } from "../../lib/persona";
import { identityFromAuth, routineFromMessages } from "../lib/identity";

/**
 * Turns the generic agent into the specific Bot this session belongs to.
 * Resolved every turn so memory, routines, and teammates stay current.
 */
export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      const identity = identityFromAuth(ctx.session.auth.initiator);
      if (!identity) return null;
      const routineId = identity.routineId ?? routineFromMessages(ctx.messages);
      const content = await buildPersona({
        userId: identity.userId,
        botId: identity.botId,
        mode: routineId ? "routine" : identity.mode === "teammate" ? "dm" : identity.mode,
        threadId: identity.threadId,
        routineId,
      });
      return content ? defineInstructions({ content }) : null;
    },
  },
});
