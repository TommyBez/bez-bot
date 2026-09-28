import { defineHook } from "eve/hooks";
import { kv } from "../../lib/store/kv";
import { logComputerActivity } from "../../lib/store/repo";
import { syncSharedDrive } from "./computer";
import { identityForSession } from "./identity";

const COMPUTER_TOOLS: Record<string, "command" | "file" | "browser" | "screen" | "credential"> = {
  bash: "command",
  write_file: "file",
  read_file: "file",
  computer: "screen",
  use_login: "credential",
  web_fetch: "browser",
};
const SANDBOX_TOOLS = new Set(["bash", "write_file", "read_file", "computer", "use_login", "glob", "grep"]);

/**
 * Mirrors what bots do on the shared computer into an activity feed, and
 * syncs the shared drive after any turn that touched the computer so the
 * next bot sees the files.
 */
export default defineHook({
  events: {
    async "action.result"(event, ctx) {
      const result = event.data.result;
      if (result.kind !== "tool-result") return;
      if (SANDBOX_TOOLS.has(result.toolName)) await kv().set(`sandbox-used:${ctx.session.id}`, true);
      const kind = COMPUTER_TOOLS[result.toolName];
      if (!kind || kind === "credential") return;
      const identity = await identityForSession(ctx.session);
      if (!identity) return;
      const label = event.data.presentation?.[result.callId]?.label ?? result.toolName;
      await logComputerActivity(identity.userId, {
        botId: identity.botId,
        kind,
        summary: label,
        detail: result.isError ? "failed" : undefined,
      });
    },
    async "turn.completed"(_event, ctx) {
      const used = await kv().get<boolean>(`sandbox-used:${ctx.session.id}`);
      if (!used) return;
      await kv().del(`sandbox-used:${ctx.session.id}`);
      const identity = await identityForSession(ctx.session);
      if (!identity) return;
      try {
        const sandbox = await ctx.getSandbox();
        await syncSharedDrive(sandbox, identity.userId, process.env.VERCEL === "1" ? "vercel" : "local");
      } catch (error) {
        console.warn("[bezbot] shared drive sync failed", error);
      }
    },
  },
});
