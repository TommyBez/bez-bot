import { type ApprovalContext, type ApprovalStatus, auto } from "eve/tools/approval";
import { getBot } from "../../lib/store/repo";
import { identityForSession } from "./identity";

/**
 * Auto Review: a reviewer model (Jev via AI Gateway) looks at the exact call
 * and only asks the person when it sees real risk.
 */
const reviewer = auto({
  instructions:
    "You review actions an AI teammate wants to take on a user's computer and accounts. Flag anything that sends messages to people outside the user's team, spends or moves money, deletes or overwrites data that may not be backed up, changes production systems, exfiltrates secrets, or installs software from untrusted sources.",
  criteria: {
    clear: "Routine, reversible, or read-only work inside the bot's own workspace.",
    caution: "The action has external, irreversible, financial, or security-relevant effects and a person should approve it.",
  },
});

function routineDenial(): ApprovalStatus {
  return {
    type: "denied",
    reason:
      "This run was started by a schedule and nobody can approve actions right now. Leave this action as a decision for the user and call notify_user.",
  };
}

async function modeFor(ctx: ApprovalContext<Record<string, unknown>>) {
  const identity = await identityForSession(ctx.session);
  const bot = identity ? await getBot(identity.botId) : null;
  return { identity, mode: bot?.autoReview ?? "auto" };
}

/** Sensitive tools (shell, computer control): follow the bot's Auto Review setting. */
export async function sensitiveApproval(ctx: ApprovalContext<Record<string, unknown>>): Promise<ApprovalStatus> {
  const { identity, mode } = await modeFor(ctx);
  if (mode === "off") return "not-applicable";
  const decision = mode === "always" ? "user-approval" : await reviewer(ctx);
  const needsPerson =
    decision === "user-approval" ||
    decision === true ||
    (typeof decision === "object" && decision !== null && decision.type === "user-approval");
  if (needsPerson && identity?.mode === "routine") return routineDenial();
  return decision;
}

/** Destructive tools: always ask a person, even with Auto Review off. */
export async function destructiveApproval(ctx: ApprovalContext<Record<string, unknown>>): Promise<ApprovalStatus> {
  const identity = await identityForSession(ctx.session);
  if (identity?.mode === "routine") return routineDenial();
  return "user-approval";
}
