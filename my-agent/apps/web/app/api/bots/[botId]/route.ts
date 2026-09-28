import { z } from "zod";
import { deleteBot, getOwnedBot, updateBot } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

type Params = { params: Promise<{ botId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const bot = await getOwnedBot(user.id, (await params).botId);
  return bot ? json({ bot }) : bad("Unknown bot.", 404);
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  label: z.string().trim().max(140).optional(),
  description: z.string().max(8000).optional(),
  emoji: z.string().max(8).optional(),
  color: z.string().max(20).optional(),
  pinned: z.boolean().optional(),
  hidden: z.boolean().optional(),
  notifications: z.boolean().optional(),
  unread: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, patchSchema);
  if (body instanceof Response) return body;
  const bot = await updateBot(user.id, (await params).botId, body);
  return bot ? json({ bot }) : bad("Unknown bot.", 404);
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const ok = await deleteBot(user.id, (await params).botId);
  return ok ? json({ ok }) : bad("Unknown bot.", 404);
}
