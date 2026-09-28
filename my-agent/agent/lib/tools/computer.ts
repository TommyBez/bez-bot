import { defineTool } from "eve/tools";
import type { ApprovalContext } from "eve/tools/approval";
import { getBot } from "../../../lib/store/repo";
import { captureScreenshot, hasDesktop } from "../computer";
import { computerUseTool as computer_use } from "../computer-use";
import { identityForSession } from "../identity";

const INTERACTIVE = new Set(["click", "double_click", "triple_click", "drag", "type", "keypress", "sequence", "clipboard_write"]);

/**
 * The bot's desktop: a browser and terminals it operates with screenshots,
 * clicks, and typing, the way a person uses a computer. Only available on
 * sandboxes with a managed desktop (Vercel Sandbox).
 */
export default defineTool({
  ...computer_use,
  description: `Use your computer's desktop (Firefox browser and xterm terminals) like a person: take screenshots, click, type, scroll, and launch apps. Use it for websites and apps without an API, and for anything that needs a real browser session. ${computer_use.description}`,
  label: {
    start: (input: { request?: { action?: string; app?: string; url?: string; text?: string } }) => {
      const r = input.request;
      if (!r) return "Using computer";
      if (r.action === "launch") return r.url ? `Opening ${r.url}` : `Opening ${r.app ?? "app"}`;
      if (r.action === "type") return "Typing";
      if (r.action === "screenshot") return "Looking at the screen";
      return `Computer: ${r.action}`;
    },
  },
  approval: async (ctx: ApprovalContext<Record<string, unknown>>) => {
    const action = (ctx.toolInput as { request?: { action?: string } } | undefined)?.request?.action ?? "";
    if (!INTERACTIVE.has(action)) return "not-applicable";
    const identity = await identityForSession(ctx.session);
    const bot = identity ? await getBot(identity.botId) : null;
    if (bot?.autoReview !== "always") return "not-applicable";
    return identity?.mode === "routine"
      ? { type: "denied", reason: "Scheduled runs cannot wait for approval; leave this for the user." }
      : "user-approval";
  },
  async execute(input, ctx) {
    const sandbox = await ctx.getSandbox();
    if (!(await hasDesktop(sandbox))) {
      throw new Error(
        "This computer has no desktop right now (desktop control runs on Vercel Sandbox). Use bash, web_fetch, and web_search instead.",
      );
    }
    // The driver resolves to one result per action (never a stream).
    const result = await (computer_use.execute(input, ctx) as Promise<unknown>);
    const identity = await identityForSession(ctx.session);
    if (identity) await captureScreenshot(sandbox, identity.userId).catch(() => false);
    return result as never;
  },
});
