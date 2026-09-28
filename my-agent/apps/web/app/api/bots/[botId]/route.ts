import { z } from "zod";
import { deleteBot, getOwnedBot, listConversations, listRoutines, updateBot } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

type Params = { params: Promise<{ botId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const { botId } = await params;
  const bot = await getOwnedBot(user.id, botId);
  if (!bot) return bad("Not found", 404);
  const [conversations, routines] = await Promise.all([listConversations(user.id, botId), listRoutines(user.id, botId)]);
  return json({ bot, conversations, routines });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  job: z.string().trim().max(140).optional(),
  description: z.string().trim().max(600).optional(),
  instructions: z.string().max(8000).optional(),
  emoji: z.string().max(8).optional(),
  color: z.string().max(20).optional(),
  autoReview: z.enum(["auto", "always", "off"]).optional(),
  autonomous: z.boolean().optional(),
  allowedPeers: z.array(z.string()).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const { botId } = await params;
  const body = await parseBody(request, patchSchema);
  if (body instanceof Response) return body;
  const bot = await updateBot(user.id, botId, body);
  if (!bot || bot.userId !== user.id) return bad("Not found", 404);
  return json({ bot });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const { botId } = await params;
  const ok = await deleteBot(user.id, botId);
  return ok ? json({ ok }) : bad("Not found", 404);
}
