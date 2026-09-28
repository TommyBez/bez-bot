import { defineTool } from "eve/tools";
import type { ApprovalContext } from "eve/tools/approval";
import { ruleOnlyApproval } from "../lib/approval";
import { captureScreenshot, ensureDesktop } from "../lib/computer";
import { computerUseTool as computer_use } from "../lib/computer-use";
import { identityForSession } from "../lib/identity";

const INTERACTIVE = new Set(["click", "double_click", "triple_click", "drag", "type", "keypress", "sequence", "clipboard_write"]);

/**
 * The bot's desktop: a browser and terminals it operates with screenshots,
 * clicks, and typing, the way a person uses a computer. Runs on Vercel
 * Sandbox and on local Docker; the desktop starts on first use.
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
    return INTERACTIVE.has(action) ? ruleOnlyApproval(ctx) : "not-applicable";
  },
  async execute(input, ctx) {
    const sandbox = await ctx.getSandbox();
    const desktop = await ensureDesktop(sandbox);
    if (!desktop.ok) throw new Error(desktop.reason);
    // The driver resolves to one result per action (never a stream).
    const result = await (computer_use.execute(input, ctx) as Promise<unknown>);
    const identity = await identityForSession(ctx.session);
    if (identity) await captureScreenshot(sandbox, identity.userId).catch(() => false);
    return result as never;
  },
});
