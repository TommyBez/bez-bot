import { defineDynamic, defineInstructions } from "eve/instructions";
import { buildPersona } from "../../lib/persona";
import { identityForSession } from "../lib/identity";

/**
 * Turns the generic agent into the specific Bot this conversation belongs to,
 * and says where the current turn came from. Resolved every turn so memory,
 * routines, skills, and teammates stay current.
 */
export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      const identity = await identityForSession(ctx.session);
      if (!identity) return null;
      const content = await buildPersona(identity);
      return content ? defineInstructions({ content }) : null;
    },
  },
});
