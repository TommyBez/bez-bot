import { defineWorkflowTool, type WorkflowStepToolContext } from "eve/tools";
import { z } from "zod";
import { signTeammateEnvelope } from "../../../lib/auth";
import { buildPersona } from "../../../lib/persona";
import { BOTNET_MAX_PER_HOUR, formatTeammateMessage, MAX_TEAMMATE_DEPTH, type TeammateEnvelope } from "../../../lib/protocol";
import {
  appendBotnetMessage,
  consumeBotnetBudget,
  createExchange,
  getExchange,
  listBots,
  pushInbox,
  setBotStatus,
  updateExchange,
} from "../../../lib/store/repo";
import type { Bot } from "../../../lib/store/types";
import { identityForSession } from "../identity";

interface HandoffPlan {
  ok: true;
  exchangeId: string;
  fromBotId: string;
  fromName: string;
  toBotId: string;
  toName: string;
  userId: string;
  envelopeMessage: string;
  agentId?: string;
}

interface HandoffRefusal {
  ok: false;
  error: string;
}

function findBot(bots: Bot[], ref: string): Bot | undefined {
  const needle = ref.trim().replace(/^@/, "").toLowerCase();
  return (
    bots.find((b) => b.id === ref.trim()) ??
    bots.find((b) => b.name.toLowerCase() === needle) ??
    bots.find((b) => b.name.toLowerCase().replace(/\s+/g, "") === needle.replace(/\s+/g, "")) ??
    bots.find((b) => b.name.toLowerCase().startsWith(needle))
  );
}

/** Validates the handoff and records the outbound message. Runs as a durable step. */
async function planHandoff(
  ctx: WorkflowStepToolContext,
  input: { to: string; message: string; conversationId?: string },
): Promise<HandoffPlan | HandoffRefusal> {
  "use step";
  const identity = await identityForSession(ctx.session);
  if (!identity) return { ok: false, error: "This session is not attached to a Bez Bot." };
  if (identity.depth >= MAX_TEAMMATE_DEPTH) {
    return { ok: false, error: "You were already delegated to; finish the work yourself instead of forwarding it." };
  }
  const bots = await listBots(identity.userId);
  const self = bots.find((b) => b.id === identity.botId);
  const target = findBot(bots, input.to);
  if (!self) return { ok: false, error: "Your bot no longer exists." };
  if (!target) {
    return { ok: false, error: `No teammate named "${input.to}". Teammates: ${bots.filter((b) => b.id !== self.id).map((b) => b.name).join(", ") || "none"}.` };
  }
  if (target.id === self.id) return { ok: false, error: "You can't message yourself." };
  if (self.allowedPeers.length > 0 && !self.allowedPeers.includes(target.id)) {
    return { ok: false, error: `${self.name} isn't allowed to message ${target.name}. The user can change this in ${self.name}'s settings.` };
  }
  if (!self.autonomous && identity.mode !== "thread" && identity.mode !== "dm" && identity.mode !== "teach") {
    return { ok: false, error: `${self.name} only messages teammates when the user asks.` };
  }
  if (!(await consumeBotnetBudget(identity.userId, BOTNET_MAX_PER_HOUR))) {
    return { ok: false, error: "The team hit its hourly limit for bot-to-bot messages. Finish with what you have." };
  }

  // Continue an earlier conversation with the same teammate when asked.
  let agentId: string | undefined;
  let exchangeId: string | undefined;
  if (input.conversationId) {
    const previous = await getExchange(input.conversationId);
    if (previous && previous.userId === identity.userId && previous.toBotId === target.id) {
      exchangeId = previous.id;
      agentId = previous.agentId;
      await updateExchange(previous.id, { status: "working" });
    }
  }
  if (!exchangeId) {
    const exchange = await createExchange({
      userId: identity.userId,
      fromBotId: self.id,
      toBotId: target.id,
      subject: input.message.split("\n")[0]!.slice(0, 140),
      originSessionId: ctx.session.id,
      threadId: identity.threadId,
    });
    exchangeId = exchange.id;
  }

  await appendBotnetMessage({
    userId: identity.userId,
    exchangeId,
    fromBotId: self.id,
    toBotId: target.id,
    kind: "request",
    text: input.message,
    originSessionId: ctx.session.id,
    depth: identity.depth + 1,
  });
  await setBotStatus(target.id, "working", `Working for ${self.name}`);
  const persona = agentId
    ? null
    : await buildPersona({
        userId: identity.userId,
        botId: target.id,
        mode: "teammate",
        fromBotId: self.id,
        threadId: identity.threadId,
        depth: identity.depth + 1,
      });

  const envelope: TeammateEnvelope = {
    userId: identity.userId,
    botId: target.id,
    fromBotId: self.id,
    exchangeId,
    depth: identity.depth + 1,
    threadId: identity.threadId,
  };

  return {
    ok: true,
    exchangeId,
    fromBotId: self.id,
    fromName: self.name,
    toBotId: target.id,
    toName: target.name,
    userId: identity.userId,
    agentId,
    envelopeMessage: formatTeammateMessage({ ...envelope, sig: signTeammateEnvelope(envelope) }, self.name, input.message, persona),
  };
}

async function recordReply(plan: HandoffPlan, reply: string, failed: boolean): Promise<void> {
  "use step";
  await appendBotnetMessage({
    userId: plan.userId,
    exchangeId: plan.exchangeId,
    fromBotId: plan.toBotId,
    toBotId: plan.fromBotId,
    kind: failed ? "error" : "reply",
    text: reply,
    depth: 1,
  });
  await updateExchange(plan.exchangeId, { status: failed ? "failed" : "replied" });
  await setBotStatus(plan.toBotId, "idle");
  await pushInbox({
    userId: plan.userId,
    botId: plan.toBotId,
    kind: "botnet",
    title: failed ? `${plan.toName} couldn't finish work for ${plan.fromName}` : `${plan.toName} replied to ${plan.fromName}`,
    body: reply.slice(0, 400),
    href: `/app/network?exchange=${plan.exchangeId}`,
  });
}

function replyText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["reply", "message", "text", "output"]) {
      if (typeof record[key] === "string") return record[key] as string;
    }
  }
  return JSON.stringify(value);
}

/**
 * Autonomous bot-to-bot messaging. The recipient runs as its own teammate
 * session (its persona, memory, and tools) on the same shared computer. The
 * call returns a receipt right away; the teammate's reply wakes this session
 * as a background task result, so bots keep talking without the user.
 */
export default defineWorkflowTool({
  description:
    "Message a teammate bot and hand them work or ask them a question. Returns immediately; their reply arrives later and wakes you so you can continue. Include everything they need, since they can't see this conversation. Send several in parallel for independent work. Pass conversationId from an earlier reply to continue that conversation.",
  inputSchema: z.object({
    to: z.string().min(1).describe("Teammate bot name (e.g. 'Research') or bot id."),
    message: z.string().min(1).max(8000),
    conversationId: z.string().optional().describe("Exchange id from an earlier reply, to continue with the same teammate."),
  }),
  execution: "background",
  label: { start: ({ to }: { to: string }) => `Asking ${to.replace(/^@/, "")}` },
  async execute({ to, message, conversationId }, ctx) {
    "use workflow";
    const plan = await planHandoff(ctx, { to, message, conversationId });
    if (!plan.ok) return { delivered: false, error: plan.error };
    try {
      const reply = await ctx.agent("teammate", {
        message: plan.envelopeMessage,
        ...(plan.agentId ? { agentId: plan.agentId } : {}),
      });
      const text = replyText(reply);
      await recordReply(plan, text, false);
      return {
        delivered: true,
        from: plan.toName,
        reply: text,
        conversationId: plan.exchangeId,
        note: `Reply from ${plan.toName}. To follow up with them, call message_bot with conversationId "${plan.exchangeId}".`,
      };
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await recordReply(plan, text, true);
      return { delivered: true, from: plan.toName, failed: true, error: text, conversationId: plan.exchangeId };
    }
  },
});
