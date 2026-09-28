import { defineTool } from "eve/tools";
import { z } from "zod";
import { deliverToBot } from "../../lib/delivery";
import { BOTNET_MAX_PER_HOUR, formatTeammateMessage } from "../../lib/protocol";
import {
  appendExchangeMessage,
  consumeBotnetBudget,
  createExchange,
  getExchange,
  listBots,
  MAX_EXCHANGE_HOPS,
} from "../../lib/store/repo";
import type { Bot, Exchange } from "../../lib/store/types";
import { requireIdentity } from "../lib/identity";

function findBot(bots: Bot[], ref: string): Bot | undefined {
  const needle = ref.trim().replace(/^@/, "").toLowerCase();
  const compact = needle.replace(/\s+/g, "");
  return (
    bots.find((b) => b.id === ref.trim()) ??
    bots.find((b) => b.name.toLowerCase() === needle) ??
    bots.find((b) => b.name.toLowerCase().replace(/\s+/g, "") === compact) ??
    bots.find((b) => b.name.toLowerCase().startsWith(needle))
  );
}

/**
 * Bot-to-Bot messaging. The message lands in the teammate's own conversation
 * (where the user can read it) and wakes it. The teammate works, then replies
 * the same way, and the reply lands here and wakes this Bot. Nothing blocks:
 * this call returns as soon as the message is delivered.
 */
export default defineTool({
  description:
    "Send a message to a teammate Bot: hand them work, ask for context they own, or reply to a teammate who messaged you. It lands in their own conversation and wakes them; their reply arrives here later as a new message. Include everything they need, since they can't see this conversation. Pass conversationId to continue or answer an earlier exchange.",
  inputSchema: z.object({
    to: z.string().min(1).describe("Teammate name (e.g. 'Research') or bot id."),
    message: z.string().min(1).max(8000),
    conversationId: z.string().optional().describe("Exchange id from an earlier message, to reply or follow up."),
  }),
  label: { start: ({ to }: { to: string }) => `Messaging ${to.replace(/^@/, "")}` },
  async execute({ to, message, conversationId }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const bots = await listBots(identity.userId);
    const self = bots.find((b) => b.id === identity.botId);
    const target = findBot(bots, to);
    if (!self) throw new Error("Your Bot no longer exists.");
    if (!target) {
      const names = bots.filter((b) => b.id !== self.id).map((b) => b.name);
      return { sent: false, error: `No teammate named "${to}". Teammates: ${names.join(", ") || "none yet"}.` };
    }
    if (target.id === self.id) return { sent: false, error: "You can't message yourself." };

    // Which exchange this belongs to: the one named, the one this turn answers, or a new one.
    let exchange: Exchange | null = null;
    const ref = conversationId ?? (identity.source === "teammate" && identity.fromBotId === target.id ? identity.exchangeId : undefined);
    if (ref) {
      const found = await getExchange(ref);
      const involves = found && [found.fromBotId, found.toBotId].includes(self.id) && [found.fromBotId, found.toBotId].includes(target.id);
      if (found && found.userId === identity.userId && involves) exchange = found;
    }
    if (exchange && exchange.hops >= MAX_EXCHANGE_HOPS) {
      return { sent: false, error: `This conversation with ${target.name} has gone back and forth ${exchange.hops} times. Wrap up with what you have and tell the user.` };
    }
    if (!(await consumeBotnetBudget(identity.userId, BOTNET_MAX_PER_HOUR))) {
      return { sent: false, error: "Your Bots hit the hourly limit for messages between Bots. Finish with what you have." };
    }
    exchange ??= await createExchange({
      userId: identity.userId,
      fromBotId: self.id,
      toBotId: target.id,
      subject: message.split("\n")[0]!.slice(0, 140),
    });
    // Answering the Bot that asked is a reply; anything else asks for something.
    const kind = exchange.toBotId === self.id ? "reply" : "request";

    await appendExchangeMessage({ exchangeId: exchange.id, fromBotId: self.id, toBotId: target.id, kind, text: message });
    await deliverToBot(target.id, {
      text: formatTeammateMessage({ kind, fromBotId: self.id, fromName: self.name, exchangeId: exchange.id }, message),
      claims: { src: "teammate", from: self.id, xch: exchange.id, mk: kind },
      dedupeKey: `${ctx.session.id}:${ctx.callId}`,
    });
    return kind === "request"
      ? {
          sent: true,
          to: target.name,
          conversationId: exchange.id,
          note: `${target.name} has your message in their conversation. Their reply will arrive here as a new message; end your turn instead of waiting.`,
        }
      : { sent: true, to: target.name, conversationId: exchange.id, note: `Your reply is in ${target.name}'s conversation.` };
  },
});
