import { z } from "zod";
import { createGroup, GROUP_MAX, GROUP_MIN, listGroups } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  return json({ groups: await listGroups(user.id) });
}

const createSchema = z.object({
  memberBotIds: z.array(z.string()).min(GROUP_MIN).max(GROUP_MAX),
  name: z.string().trim().max(80).optional(),
  description: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, createSchema);
  if (body instanceof Response) return body;
  try {
    return json({ group: await createGroup(user.id, body) }, { status: 201 });
  } catch (error) {
    return bad(error instanceof Error ? error.message : "Couldn't create the group.");
  }
}
