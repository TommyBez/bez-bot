import { defineHook } from "eve/hooks";
import {
  getBot,
  getRoutine,
  markRoutineFinished,
  pushInbox,
  setBotStatus,
} from "../../lib/store/repo";
import { kv } from "../../lib/store/kv";
import { identityForSession } from "../lib/identity";

/**
 * Keeps each bot's live status ("Working", "Needs you", "Idle") and the
 * user's inbox in sync with what its sessions are doing.
 */
export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      const identity = await identityForSession(ctx.session);
      if (identity) await setBotStatus(identity.botId, "working", identity.mode === "routine" ? "Running a routine" : "Working");
    },
    async "input.requested"(event, ctx) {
      const identity = await identityForSession(ctx.session);
      if (!identity) return;
      const bot = await getBot(identity.botId);
      await kv().update<string[]>(`pending:${ctx.session.id}`, (ids) => [
        ...new Set([...(ids ?? []), ...event.data.requests.map((r) => r.requestId)]),
      ]);
      await setBotStatus(identity.botId, "waiting", "Needs your approval");
      for (const request of event.data.requests) {
        await pushInbox({
          userId: identity.userId,
          botId: identity.botId,
          kind: request.kind === "question" ? "question" : "approval",
          title:
            request.kind === "question"
              ? `${bot?.name ?? "A bot"} has a question`
              : `${bot?.name ?? "A bot"} needs your approval`,
          body: request.prompt,
          sessionId: ctx.session.id,
          href: identity.threadId
            ? `/app/threads/${identity.threadId}`
            : identity.conversationId
              ? `/app/bots/${identity.botId}/c/${identity.conversationId}`
              : `/app/bots/${identity.botId}`,
        });
      }
    },
    async "message.completed"(event, ctx) {
      if (event.data.finishReason !== "stop" || !event.data.message) return;
      await kv().set(`lastmsg:${ctx.session.id}`, event.data.message.slice(0, 4000));
    },
    async "input.resolved"(event, ctx) {
      const resolved = new Set(event.data.resolutions.map((r) => r.requestId));
      const left = await kv().update<string[]>(`pending:${ctx.session.id}`, (ids) => {
        const next = (ids ?? []).filter((id) => !resolved.has(id));
        return next.length > 0 ? next : null;
      });
      const identity = await identityForSession(ctx.session);
      if (identity && !left) await setBotStatus(identity.botId, "working");
    },
    async "turn.completed"(_event, ctx) {
      const identity = await identityForSession(ctx.session);
      if (!identity) return;
      const pending = await kv().get<string[]>(`pending:${ctx.session.id}`);
      await setBotStatus(identity.botId, pending?.length ? "waiting" : "idle", pending?.length ? "Needs your approval" : undefined);
      if (identity.mode === "routine" && identity.routineId) {
        await markRoutineFinished(identity.routineId, "succeeded");
        const [routine, bot, last] = await Promise.all([
          getRoutine(identity.routineId),
          getBot(identity.botId),
          kv().get<string>(`lastmsg:${ctx.session.id}`),
        ]);
        await pushInbox({
          userId: identity.userId,
          botId: identity.botId,
          kind: "done",
          title: `${bot?.name ?? "A bot"} finished “${routine?.name ?? "a routine"}”`,
          body: last ?? undefined,
          sessionId: ctx.session.id,
          href: `/app/routines/${identity.routineId}`,
        });
      }
    },
    async "turn.failed"(event, ctx) {
      const identity = await identityForSession(ctx.session);
      if (!identity) return;
      await setBotStatus(identity.botId, "error", event.data.message.slice(0, 120));
      if (identity.mode === "routine" && identity.routineId) {
        await markRoutineFinished(identity.routineId, "failed");
        await pushInbox({
          userId: identity.userId,
          botId: identity.botId,
          kind: "error",
          title: "A routine run failed",
          body: event.data.message,
          sessionId: ctx.session.id,
          href: `/app/routines/${identity.routineId}`,
        });
      }
    },
    async "turn.cancelled"(_event, ctx) {
      const identity = await identityForSession(ctx.session);
      if (identity) await setBotStatus(identity.botId, "idle");
    },
  },
});
