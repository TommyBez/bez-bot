import { z } from "zod";
import { postToGroup } from "@shared/groups";
import { getOwnedGroup, listGroupMessages } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

type Params = { params: Promise<{ groupId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const group = await getOwnedGroup(user.id, (await params).groupId);
  if (!group) return bad("Unknown group.", 404);
  return json({ group, messages: await listGroupMessages(group.id) });
}

const postSchema = z.object({ text: z.string().trim().min(1).max(8000) });

export async function POST(request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, postSchema);
  if (body instanceof Response) return body;
  try {
    const message = await postToGroup(user.id, (await params).groupId, "user", body.text);
    return message ? json({ message }, { status: 201 }) : bad("Unknown group.", 404);
  } catch (error) {
    return bad(error instanceof Error ? error.message : "Couldn't reach the group.", 502);
  }
}
