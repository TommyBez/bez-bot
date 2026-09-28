import { z } from "zod";
import { listSkills, saveSkill } from "@shared/store/repo";
import { json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  return json({ skills: await listSkills(user.id) });
}

const schema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().min(3).max(300),
  body: z.string().trim().min(10).max(12000),
});

export async function POST(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, schema);
  if (body instanceof Response) return body;
  return json({ skill: await saveSkill(user.id, { ...body, source: "chat", draft: false }) }, { status: 201 });
}
