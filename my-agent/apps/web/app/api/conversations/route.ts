import { z } from "zod";
import { createConversation, getOwnedBot, listConversations } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

export async function GET(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const botId = new URL(request.url).searchParams.get("botId") ?? undefined;
  return json({ conversations: await listConversations(user.id, botId) });
}

const schema = z.object({
  botId: z.string(),
  title: z.string().max(120).optional(),
  mode: z.enum(["dm", "teach"]).default("dm"),
});

export async function POST(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, schema);
  if (body instanceof Response) return body;
  if (!(await getOwnedBot(user.id, body.botId))) return bad("Unknown bot.", 404);
  const conversation = await createConversation(user.id, body.botId, {
    title: body.title ?? (body.mode === "teach" ? "Teaching a task" : "New task"),
    mode: body.mode,
  });
  return json({ conversation }, { status: 201 });
}
