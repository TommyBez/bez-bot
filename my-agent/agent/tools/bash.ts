import { defineTool } from "eve/tools";
import type { ApprovalContext } from "eve/tools/approval";
import { bash } from "eve/tools/bash";
import { sensitiveApproval } from "../lib/approval";

/** Commands that can reach outside the workspace or destroy data go through Auto Review. */
const RISKY = [
  // Any recursive delete, whatever the target: `rm -rf shared` wipes the drive as surely as `rm -rf /workspace`.
  /\brm\b[^|;&\n]*\s(?:-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)(?=\s|$)/,
  /\bfind\b[^|;&\n]*\s-delete\b/,
  /\bsudo\b/,
  /\b(curl|wget|http)\b[^|]*\s-(X|d|F|-data|-request)\b/i,
  /\bgit\s+push\b/,
  /\b(npm|pnpm|yarn)\s+publish\b/,
  /\b(ssh|scp|rsync|sftp)\b/,
  /\b(mkfs|dd|shred)\b/,
  /\bchmod\s+-R\b/,
  /\b(sendmail|mail|mutt)\b/,
  /\bvercel\b.*\b(deploy|--prod|rm|remove)\b/,
  /\bkubectl\b|\bterraform\s+(apply|destroy)\b/,
  /\bDROP\s+(TABLE|DATABASE)\b|\bDELETE\s+FROM\b|\bTRUNCATE\b/i,
];

export default defineTool({
  ...bash,
  description: `${bash.description} Runs on your own computer (shared with your teammates). Keep work under /workspace; put files meant to last or to share under /workspace/shared.`,
  approval: async (ctx: ApprovalContext<Record<string, unknown>>) => {
    const command = String((ctx.toolInput as { command?: unknown } | undefined)?.command ?? "");
    if (!RISKY.some((re) => re.test(command))) return "not-applicable";
    return sensitiveApproval(ctx);
  },
});
