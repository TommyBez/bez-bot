import { getMemory, getOwnedBot, removeMemory } from "@shared/store/repo";
import { bad, json } from "@/lib/http";
import { userOr401 } from "@/lib/session";

type Params = { params: Promise<{ botId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const bot = await getOwnedBot(user.id, (await params).botId);
  if (!bot) return bad("Unknown bot.", 404);
  return json({ memory: await getMemory(user.id, bot.id) });
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const bot = await getOwnedBot(user.id, (await params).botId);
  const entryId = new URL(request.url).searchParams.get("entry");
  if (!bot || !entryId) return bad("Unknown memory entry.", 404);
  return json({ removed: await removeMemory(user.id, bot.id, entryId) });
}
