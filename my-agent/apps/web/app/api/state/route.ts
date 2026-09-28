import { listBots, listGroups } from "@shared/store/repo";
import { json } from "@/lib/http";
import { userOr401 } from "@/lib/session";

/** Everything the sidebar needs in one poll: Bots and groups with live status and unread state. */
export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const [bots, groups] = await Promise.all([listBots(user.id), listGroups(user.id)]);
  return json({ user, bots, groups });
}
