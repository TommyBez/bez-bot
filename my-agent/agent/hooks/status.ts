import { defineHook } from "eve/hooks";
import { deliverToBot } from "../../lib/delivery";
import { postToGroup } from "../../lib/groups";
import { formatTeammateMessage, NO_REPLY } from "../../lib/protocol";
import { kv } from "../../lib/store/kv";
import {
  appendExchangeMessage,
  finishRoutineRun,
  getBot,
  getExchange,
  getGroup,
  markBotActivity,
  setBotStatus,
  setGroupWorking,
} from "../../lib/store/repo";
import { identityForSession, type TurnIdentity } from "../lib/identity";

function workingText(identity: TurnIdentity, fromName?: string, groupName?: string): string {
  if (identity.kind === "group") return groupName ? `In ${groupName}` : "In a group chat";
  if (identity.source === "routine") return "Running a routine";
  if (identity.source === "teammate") return fromName ? `Working for ${fromName}` : "Working for a teammate";
  return "Working";
}

/**
 * A teammate asked this Bot for something and the turn ended without an
 * answer going back. Send the Bot's final message as the reply so the
 * asking Bot always wakes up.
 */
async function replyIfUnanswered(identity: TurnIdentity, sessionId: string, finalText: string | null): Promise<void> {
  if (identity.source !== "teammate" || identity.messageKind !== "request" || !identity.exchangeId || !identity.fromBotId) return;
  const exchange = await getExchange(identity.exchangeId);
  if (!exchange || exchange.userId !== identity.userId || exchange.status !== "open") return;
  const self = await getBot(identity.botId);
  if (!self) return;
  const text = finalText?.trim() || `${self.name} finished without a written answer.`;
  await appendExchangeMessage({ exchangeId: exchange.id, fromBotId: self.id, toBotId: identity.fromBotId, kind: "reply", text });
  await deliverToBot(identity.fromBotId, {
    text: formatTeammateMessage({ kind: "reply", fromBotId: self.id, fromName: self.name, exchangeId: exchange.id }, text),
    claims: { src: "teammate", from: self.id, xch: exchange.id, mk: "reply" },
    dedupeKey: `auto-reply:${sessionId}:${exchange.id}:${exchange.hops}`,
  });
}

/**
 * Keeps each Bot's sidebar state (working, needs attention, unread) in sync
 * with its conversations, finishes routine runs, answers teammates, and posts
 * a Bot's group-chat replies to the group.
 */
export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      await kv().del(`lastmsg:${ctx.session.id}`);
      const identity = await identityForSession(ctx.session);
      if (!identity) return;
      const [from, group] = await Promise.all([
        identity.fromBotId ? getBot(identity.fromBotId) : null,
        identity.groupId ? getGroup(identity.groupId) : null,
      ]);
      if (identity.kind === "group" && identity.groupId) await setGroupWorking(identity.groupId, identity.botId, true);
      await setBotStatus(identity.botId, "working", workingText(identity, from?.name, group?.name));
    },
    async "input.requested"(event, ctx) {
      const identity = await identityForSession(ctx.session);
      if (!identity) return;
      await kv().update<string[]>(`pending:${ctx.session.id}`, (ids) => [
        ...new Set([...(ids ?? []), ...event.data.requests.map((r) => r.requestId)]),
      ]);
      const question = event.data.requests.some((r) => r.kind === "question");
      await setBotStatus(identity.botId, "attention", question ? "Has a question" : "Needs your approval");
      if (identity.kind === "bot") await markBotActivity(identity.botId, question ? "Has a question for you" : "Needs your approval", true);
    },
    async "input.resolved"(event, ctx) {
      const resolved = new Set(event.data.resolutions.map((r) => r.requestId));
      const left = await kv().update<string[]>(`pending:${ctx.session.id}`, (ids) => {
        const next = (ids ?? []).filter((id) => !resolved.has(id));
        return next.length > 0 ? next : null;
      });
      const identity = await identityForSession(ctx.session);
      if (identity && !left) await setBotStatus(identity.botId, "working", "Working");
    },
    async "message.completed"(event, ctx) {
      if (event.data.finishReason !== "stop" || !event.data.message) return;
      await kv().set(`lastmsg:${ctx.session.id}`, event.data.message.slice(0, 8000));
    },
    async "turn.completed"(_event, ctx) {
      const identity = await identityForSession(ctx.session);
      if (!identity) return;
      const [pending, last] = await Promise.all([
        kv().get<string[]>(`pending:${ctx.session.id}`),
        kv().get<string>(`lastmsg:${ctx.session.id}`),
      ]);
      await setBotStatus(
        identity.botId,
        pending?.length ? "attention" : "idle",
        pending?.length ? "Needs your approval" : undefined,
      );

      if (identity.kind === "group" && identity.groupId) {
        await setGroupWorking(identity.groupId, identity.botId, false);
        const text = last?.trim() ?? "";
        if (text && !text.startsWith(NO_REPLY)) await postToGroup(identity.userId, identity.groupId, identity.botId, text);
        return;
      }

      if (last) await markBotActivity(identity.botId, last, true);
      if (identity.source === "routine" && identity.routineId && identity.runId) {
        await finishRoutineRun(identity.routineId, identity.runId, "succeeded");
      }
      await replyIfUnanswered(identity, ctx.session.id, last);
    },
    async "turn.failed"(event, ctx) {
      const identity = await identityForSession(ctx.session);
      if (!identity) return;
      await setBotStatus(identity.botId, "error", event.data.message.slice(0, 120));
      if (identity.kind === "group" && identity.groupId) {
        await setGroupWorking(identity.groupId, identity.botId, false);
        return;
      }
      await markBotActivity(identity.botId, `Hit an error: ${event.data.message}`, true);
      if (identity.source === "routine" && identity.routineId && identity.runId) {
        await finishRoutineRun(identity.routineId, identity.runId, "failed");
      }
      await replyIfUnanswered(identity, ctx.session.id, `I hit an error and couldn't finish: ${event.data.message.slice(0, 300)}`);
    },
    async "turn.cancelled"(_event, ctx) {
      const identity = await identityForSession(ctx.session);
      if (!identity) return;
      await setBotStatus(identity.botId, "idle");
      if (identity.kind === "group" && identity.groupId) await setGroupWorking(identity.groupId, identity.botId, false);
    },
  },
});
