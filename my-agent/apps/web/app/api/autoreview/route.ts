import { z } from "zod";
import { addAutoReviewRule, getUser, removeAutoReviewRule, updateUser } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  return json({ autoReview: user.autoReview });
}

const putSchema = z.object({ enabled: z.boolean() });

export async function PUT(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, putSchema);
  if (body instanceof Response) return body;
  const next = await updateUser(user.id, { autoReview: { ...user.autoReview, enabled: body.enabled } });
  return json({ autoReview: next?.autoReview });
}

const ruleSchema = z.object({
  kind: z.enum(["ask", "allow"]),
  tool: z.string().trim().min(1).max(60),
  match: z.string().trim().max(200).default(""),
  description: z.string().trim().max(200).default(""),
});

/** Adds a rule. "Always allow" on an approval card saves an allow rule for that action. */
export async function POST(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, ruleSchema);
  if (body instanceof Response) return body;
  const rule = await addAutoReviewRule(user.id, {
    ...body,
    description: body.description || `${body.kind === "ask" ? "Ask first" : "Allow automatically"}: ${body.tool}${body.match ? ` “${body.match}”` : ""}`,
  });
  return json({ rule, autoReview: (await getUser(user.id))?.autoReview });
}

export async function DELETE(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const id = new URL(request.url).searchParams.get("rule");
  if (!id) return bad("Missing rule id.");
  await removeAutoReviewRule(user.id, id);
  return json({ autoReview: (await getUser(user.id))?.autoReview });
}
