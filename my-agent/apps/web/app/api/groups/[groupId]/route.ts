import { z } from "zod";
import { deleteGroup, getOwnedGroup, GROUP_MAX, GROUP_MIN, listBots, updateGroup } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

type Params = { params: Promise<{ groupId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const group = await getOwnedGroup(user.id, (await params).groupId);
  return group ? json({ group }) : bad("Unknown group.", 404);
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(2000).optional(),
  memberBotIds: z.array(z.string()).min(GROUP_MIN).max(GROUP_MAX).optional(),
  pinned: z.boolean().optional(),
  hidden: z.boolean().optional(),
  unread: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, patchSchema);
  if (body instanceof Response) return body;
  if (body.memberBotIds) {
    const mine = new Set((await listBots(user.id)).map((b) => b.id));
    if (!body.memberBotIds.every((id) => mine.has(id))) return bad("Unknown bot.");
  }
  const group = await updateGroup(user.id, (await params).groupId, body);
  return group ? json({ group }) : bad("Unknown group.", 404);
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  await deleteGroup(user.id, (await params).groupId);
  return json({ ok: true });
}
