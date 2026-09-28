import { ensureBotSession } from "@shared/delivery";
import { duplicateBot } from "@shared/store/repo";
import { bad, json } from "@/lib/http";
import { userOr401 } from "@/lib/session";

export async function POST(_request: Request, { params }: { params: Promise<{ botId: string }> }) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const bot = await duplicateBot(user.id, (await params).botId, user.timezone ?? "UTC");
  if (!bot) return bad("Unknown bot.", 404);
  await ensureBotSession(bot).catch(() => undefined);
  return json({ bot }, { status: 201 });
}
