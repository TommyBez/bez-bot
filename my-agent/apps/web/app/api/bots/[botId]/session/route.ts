import { ensureBotSession } from "@shared/delivery";
import { getOwnedBot } from "@shared/store/repo";
import { bad, json } from "@/lib/http";
import { userOr401 } from "@/lib/session";

/** Returns the Bot's one conversation, creating it the first time. */
export async function POST(_request: Request, { params }: { params: Promise<{ botId: string }> }) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const bot = await getOwnedBot(user.id, (await params).botId);
  if (!bot) return bad("Unknown bot.", 404);
  try {
    return json({ sessionId: await ensureBotSession(bot) });
  } catch (error) {
    return bad(error instanceof Error ? error.message : "Couldn't open the conversation.", 502);
  }
}
