import { ensureBotSession } from "@shared/delivery";
import { addSharedBot, getSharedBot } from "@shared/store/repo";
import { bad, json } from "@/lib/http";
import { userOr401 } from "@/lib/session";

export async function GET(_request: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const shared = await getSharedBot(shareId);
  return shared ? json({ shared }) : bad("Not found", 404);
}

/** "Add to Bez Bot": copies a shared Bot, its routines, and its skills into the caller's team. */
export async function POST(_request: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const { shareId } = await params;
  const bot = await addSharedBot(user.id, shareId, user.timezone ?? "UTC");
  if (!bot) return bad("Not found", 404);
  await ensureBotSession(bot).catch(() => undefined);
  return json({ bot }, { status: 201 });
}
