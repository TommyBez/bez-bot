import { z } from "zod";
import { deleteConversation, getConversation, updateConversation } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

type Params = { params: Promise<{ conversationId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const { conversationId } = await params;
  const conversation = await getConversation(conversationId);
  if (!conversation || conversation.userId !== user.id) return bad("Not found", 404);
  return json({ conversation });
}

const schema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  sessionId: z.string().min(1).max(200).optional(),
});

/** The chat UI reports the eve session id here once the first message is accepted. */
export async function PATCH(request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const { conversationId } = await params;
  const body = await parseBody(request, schema);
  if (body instanceof Response) return body;
  const existing = await getConversation(conversationId);
  if (!existing || existing.userId !== user.id) return bad("Not found", 404);
  if (body.sessionId && existing.sessionId && existing.sessionId !== body.sessionId) {
    return bad("Conversation already has a session.", 409);
  }
  return json({ conversation: await updateConversation(user.id, conversationId, body) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const { conversationId } = await params;
  await deleteConversation(user.id, conversationId);
  return json({ ok: true });
}
