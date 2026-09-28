import { type ApprovalContext, type ApprovalStatus, auto } from "eve/tools/approval";
import { actionSummary } from "../../lib/actions";
import { getUser } from "../../lib/store/repo";
import type { AutoReviewRule } from "../../lib/store/types";
import { identityForSession } from "./identity";

/**
 * Auto Review: an independent reviewer model looks at the exact call and
 * only asks the person when it sees real risk.
 */
const reviewer = auto({
  instructions:
    "You review actions an AI teammate wants to take on a user's computer and accounts. Flag anything that sends messages to people outside the user's team, spends or moves money, deletes or overwrites data that may not be backed up, changes production systems, exfiltrates secrets, or installs software from untrusted sources.",
  criteria: {
    clear: "Routine, reversible, or read-only work inside the bot's own workspace.",
    caution: "The action has external, irreversible, financial, or security-relevant effects and a person should approve it.",
  },
});

function matching(rules: AutoReviewRule[], toolName: string, input: unknown): { ask: boolean; allow: boolean } {
  const summary = actionSummary(toolName, input).toLowerCase();
  const hit = (r: AutoReviewRule) => r.tool === toolName && (!r.match || summary.includes(r.match.toLowerCase()));
  return { ask: rules.some((r) => r.kind === "ask" && hit(r)), allow: rules.some((r) => r.kind === "allow" && hit(r)) };
}

async function settingsFor(ctx: ApprovalContext<Record<string, unknown>>) {
  const identity = await identityForSession(ctx.session);
  const user = identity ? await getUser(identity.userId) : null;
  return user?.autoReview ?? { enabled: true, rules: [] };
}

/**
 * Risky tools (shell, logins, creating Bots). "Ask first" rules always stop
 * the action, "Allow automatically" rules let it through, and otherwise the
 * reviewer decides. With Auto Review off, the person is asked.
 */
export async function sensitiveApproval(ctx: ApprovalContext<Record<string, unknown>>): Promise<ApprovalStatus> {
  const settings = await settingsFor(ctx);
  const rules = matching(settings.rules, ctx.toolName, ctx.toolInput);
  if (rules.ask) return "user-approval";
  if (rules.allow) return "not-applicable";
  if (!settings.enabled) return "user-approval";
  return reviewer(ctx);
}

/** Destructive tools: always ask, unless the person saved an "Always allow" rule for it. */
export async function destructiveApproval(ctx: ApprovalContext<Record<string, unknown>>): Promise<ApprovalStatus> {
  const settings = await settingsFor(ctx);
  const rules = matching(settings.rules, ctx.toolName, ctx.toolInput);
  if (rules.allow && !rules.ask) return "not-applicable";
  return "user-approval";
}

/** Desktop clicks and typing: only an explicit "Ask first" rule stops them. */
export async function ruleOnlyApproval(ctx: ApprovalContext<Record<string, unknown>>): Promise<ApprovalStatus> {
  const settings = await settingsFor(ctx);
  return matching(settings.rules, ctx.toolName, ctx.toolInput).ask ? "user-approval" : "not-applicable";
}
