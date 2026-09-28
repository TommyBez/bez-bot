import type { SandboxSession } from "eve/sandbox";
import { DefaultSandbox, defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";
import { installDesktop, restoreSharedDrive } from "./lib/computer";

/**
 * The user's computer, shared by all of their Bots.
 *
 * On Vercel (or with `BEZBOT_SANDBOX=vercel` and linked credentials) this is a
 * persistent Vercel Sandbox. Elsewhere eve picks Docker, microsandbox, or
 * just-bash. Vercel Sandbox and Docker get a desktop (Xvfb, a window manager,
 * Firefox, and xterm) baked into their template; the `computer` tool starts it
 * on first use and drives it through screenshots, clicks, and keystrokes.
 * just-bash gives the Bot a shell and files but no desktop.
 */
const useVercel =
  process.env.BEZBOT_SANDBOX === "vercel" || (process.env.VERCEL === "1" && process.env.BEZBOT_SANDBOX !== "default");

async function prepare(sandbox: SandboxSession) {
  if (process.env.BEZBOT_DESKTOP === "0") return;
  try {
    await installDesktop(sandbox);
  } catch (error) {
    // Deployments must ship the desktop; a local host without apt or root just goes without.
    if (useVercel) throw error;
    console.warn("[bezbot] desktop not installed on this sandbox; Bots get a shell and files only", error);
  }
}

export const environment = useVercel ? VercelSandbox.environment({ prepare }) : DefaultSandbox.environment({ prepare });

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
  return sandbox;
});
