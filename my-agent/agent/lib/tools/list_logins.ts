import { defineTool } from "eve/tools";
import { z } from "zod";
import { listVault } from "../../../lib/store/repo";
import { requireIdentity } from "../identity";

export default defineTool({
  description:
    "List the logins the user saved for the team (site, label, username). Passwords are never shown; use use_login to type one into the computer.",
  inputSchema: z.object({}),
  label: { start: () => "Checking saved logins" },
  async execute(_input, ctx) {
    const identity = await requireIdentity(ctx.session);
    const entries = await listVault(identity.userId);
    return entries.map((e) => ({ id: e.id, label: e.label, site: e.site, username: e.username, notes: e.notes ?? null }));
  },
});
