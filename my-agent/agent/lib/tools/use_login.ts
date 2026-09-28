import { defineTool } from "eve/tools";
import { z } from "zod";
import { decryptSecret } from "../../../lib/auth";
import { listVault, logComputerActivity } from "../../../lib/store/repo";
import { sensitiveApproval } from "../approval";
import { hasDesktop } from "../computer";
import { requireIdentity } from "../identity";

/**
 * Types a saved credential into the focused field on the bot's desktop. The
 * secret travels only as a process environment variable inside the sandbox;
 * it never enters the model's context or the tool result.
 */
export default defineTool({
  description:
    "Type a saved login into the currently focused field on your computer's desktop. Click the username or password field first. Without a desktop, writes the credential to a private env file for command-line tools.",
  inputSchema: z.object({
    loginId: z.string().describe("Id from list_logins."),
    field: z.enum(["username", "password", "username_tab_password"]).default("username_tab_password"),
    submit: z.boolean().default(false).describe("Press Enter after typing."),
  }),
  approval: sensitiveApproval,
  label: { start: () => "Signing in with a saved login" },
  async execute({ loginId, field, submit }, ctx) {
    const identity = await requireIdentity(ctx.session);
    const entry = (await listVault(identity.userId)).find((e) => e.id === loginId);
    if (!entry) throw new Error("Unknown login. Call list_logins first.");
    const password = decryptSecret(identity.userId, entry.secret);
    const sandbox = await ctx.getSandbox();

    if (await hasDesktop(sandbox)) {
      const typeValue = 'xdotool type --clearmodifiers --delay 25 -- "$BEZBOT_VALUE"';
      const steps =
        field === "username"
          ? [typeValue]
          : field === "password"
            ? [typeValue]
            : ['xdotool type --clearmodifiers --delay 25 -- "$BEZBOT_USER"', "xdotool key Tab", 'xdotool type --clearmodifiers --delay 25 -- "$BEZBOT_PASS"'];
      if (submit) steps.push("xdotool key Return");
      const result = await sandbox.run({
        command: `export DISPLAY=:99; ${steps.join(" && ")}`,
        env: {
          BEZBOT_VALUE: field === "username" ? entry.username : password,
          BEZBOT_USER: entry.username,
          BEZBOT_PASS: password,
        },
      });
      if (result.exitCode !== 0) throw new Error("Could not type into the desktop. Take a screenshot and focus the field.");
      await logComputerActivity(identity.userId, {
        botId: identity.botId,
        kind: "credential",
        summary: `Signed in to ${entry.site} as ${entry.username}`,
      });
      return { typed: true, site: entry.site, username: entry.username, submitted: submit };
    }

    const file = `$HOME/.bezbot/logins/${entry.id}.env`;
    const result = await sandbox.run({
      command: `mkdir -p "$HOME/.bezbot/logins" && umask 077 && printf 'LOGIN_SITE=%s\\nLOGIN_USERNAME=%s\\nLOGIN_PASSWORD=%s\\n' "$BEZBOT_SITE" "$BEZBOT_USER" "$BEZBOT_PASS" > "${file}"`,
      env: { BEZBOT_SITE: entry.site, BEZBOT_USER: entry.username, BEZBOT_PASS: password },
    });
    if (result.exitCode !== 0) throw new Error("Could not store the login on the computer.");
    await logComputerActivity(identity.userId, {
      botId: identity.botId,
      kind: "credential",
      summary: `Loaded login for ${entry.site}`,
    });
    return {
      typed: false,
      envFile: file,
      usage: `Run commands with: set -a; . ${file}; set +a  (variables LOGIN_USERNAME, LOGIN_PASSWORD). Never print them.`,
    };
  },
});
