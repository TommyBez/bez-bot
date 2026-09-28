import { z } from "zod";
import { deleteSkill, updateSkill } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

type Params = { params: Promise<{ skillId: string }> };

const schema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  body: z.string().trim().min(10).max(12000).optional(),
  draft: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, schema);
  if (body instanceof Response) return body;
  const skill = await updateSkill(user.id, (await params).skillId, body);
  return skill ? json({ skill }) : bad("Not found", 404);
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  await deleteSkill(user.id, (await params).skillId);
  return json({ ok: true });
}
