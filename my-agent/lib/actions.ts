/** Shared by the approval policy and the "Review an action" card. */

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** One-line description of a tool call, used for rule matching. */
export function actionSummary(toolName: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  switch (toolName) {
    case "bash":
      return str(i.command);
    case "use_login":
      return str(i.loginId);
    case "computer": {
      const request = (i.request ?? {}) as Record<string, unknown>;
      return [str(request.action), str(request.text)].filter(Boolean).join(" ");
    }
    case "create_bot":
      return str(i.name);
    case "delete_routine":
      return str(i.id);
    default:
      return JSON.stringify(i).slice(0, 200);
  }
}

/** What an "Always allow" rule should match for this call. */
export function proposeRuleMatch(toolName: string, input: unknown): string {
  const summary = actionSummary(toolName, input).trim();
  if (toolName === "bash") return summary.split(/\s+/).slice(0, 2).join(" ");
  if (toolName === "use_login" || toolName === "delete_routine") return summary;
  if (toolName === "computer") return summary.split(/\s+/)[0] ?? "";
  return "";
}

const TOOL_NAMES: Record<string, string> = {
  bash: "Run a command",
  use_login: "Sign in with a saved login",
  computer: "Use the computer",
  create_bot: "Create a Bot",
  delete_routine: "Delete a routine",
};

export function actionTitle(toolName: string): string {
  return TOOL_NAMES[toolName] ?? toolName.replace(/_/g, " ");
}
