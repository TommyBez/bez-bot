import { z } from "zod";
import { deleteThread, getThread, listBots, updateThread } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

type Params = { params: Promise<{ threadId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const { threadId } = await params;
  const thread = await getThread(threadId);
  if (!thread || thread.userId !== user.id) return bad("Not found", 404);
  return json({ thread });
}

const schema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  memberBotIds: z.array(z.string()).min(1).max(12).optional(),
  leadBotId: z.string().optional(),
  sessionId: z.string().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const { threadId } = await params;
  const body = await parseBody(request, schema);
  if (body instanceof Response) return body;
  const thread = await getThread(threadId);
  if (!thread || thread.userId !== user.id) return bad("Not found", 404);
  if (body.memberBotIds) {
    const owned = new Set((await listBots(user.id)).map((b) => b.id));
    body.memberBotIds = body.memberBotIds.filter((id) => owned.has(id));
  }
  if (body.sessionId && thread.sessionId && thread.sessionId !== body.sessionId) delete body.sessionId;
  return json({ thread: await updateThread(user.id, threadId, body) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const { threadId } = await params;
  await deleteThread(user.id, threadId);
  return json({ ok: true });
}
