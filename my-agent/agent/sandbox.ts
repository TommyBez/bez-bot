import { DefaultSandbox, defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";
import { restoreSharedDrive } from "./lib/computer";
import { installComputerUse, startComputerUse } from "./lib/computer-use";

/**
 * The user's computer, shared by all of their Bots.
 *
 * On Vercel (or with `BEZBOT_SANDBOX=vercel` and linked credentials) this is a
 * persistent Vercel Sandbox with a desktop: Xvfb, a window manager, Firefox,
 * and xterm, driven by the `computer` tool through screenshots, clicks, and
 * keystrokes. Elsewhere eve picks Docker, microsandbox, or just-bash, which
 * gives the bot a shell and files but no desktop.
 */
const useVercel =
  process.env.BEZBOT_SANDBOX === "vercel" || (process.env.VERCEL === "1" && process.env.BEZBOT_SANDBOX !== "default");
const withDesktop = useVercel && process.env.BEZBOT_DESKTOP !== "0";

export const environment = useVercel
  ? VercelSandbox.environment({
      prepare: async (sandbox) => {
        if (withDesktop) await installComputerUse(sandbox);
      },
    })
  : DefaultSandbox.environment();

export default defineSandbox(async ({ session }) => {
  const sandbox = await environment.open();
  await sandbox.run({ command: "mkdir -p /workspace/.bezbot /workspace/shared" });

  const userId = (session.auth.initiator?.attributes as Record<string, string> | undefined)?.userId;
  if (userId) {
    try {
      await restoreSharedDrive(sandbox, userId);
    } catch (error) {
      console.warn("[bezbot] could not restore shared drive", error);
    }
  }

  if (withDesktop) {
    try {
      await startComputerUse(sandbox);
      await sandbox.writeTextFile({ path: "/workspace/.bezbot/desktop", content: new Date().toISOString() });
    } catch (error) {
      console.warn("[bezbot] desktop failed to start; continuing without computer use", error);
    }
  }
  return sandbox;
});
