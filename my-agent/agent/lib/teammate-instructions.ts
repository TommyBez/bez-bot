import { defineDynamic, defineInstructions } from "eve/instructions";
import { buildPersona } from "../../lib/persona";
import { envelopeFromMessages } from "./identity";

/** Loads the persona of the bot named in the teammate envelope. */
export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      const envelope = envelopeFromMessages(ctx.messages);
      if (!envelope) return null;
      const content = await buildPersona({
        userId: envelope.userId,
        botId: envelope.botId,
        mode: "teammate",
        fromBotId: envelope.fromBotId,
        threadId: envelope.threadId,
        depth: envelope.depth,
      });
      return content ? defineInstructions({ content }) : null;
    },
  },
});
