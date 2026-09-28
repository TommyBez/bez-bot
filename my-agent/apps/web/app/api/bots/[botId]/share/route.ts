import { shareBot } from "@shared/store/repo";
import { bad, json } from "@/lib/http";
import { userOr401 } from "@/lib/session";

/** Share menu → Create template: a public "Add to Bez Bot" link with the Bot's identity, description, skills, and routines. */
export async function POST(_request: Request, { params }: { params: Promise<{ botId: string }> }) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const { botId } = await params;
  const shared = await shareBot(user.id, botId);
  if (!shared) return bad("Not found", 404);
  return json({ shared, url: `/b/${shared.shareId}` });
}
