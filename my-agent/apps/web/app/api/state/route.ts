import { listBots, listConversations, listInbox, listThreads } from "@shared/store/repo";
import { json } from "@/lib/http";
import { userOr401 } from "@/lib/session";

/** Everything the app shell needs in one poll: bots with live status, threads, recent tasks, inbox count. */
export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const [bots, threads, conversations, inbox] = await Promise.all([
    listBots(user.id),
    listThreads(user.id),
    listConversations(user.id),
    listInbox(user.id),
  ]);
  return json({
    user,
    bots,
    threads,
    conversations: conversations.slice(0, 40),
    unread: inbox.filter((i) => !i.read).length,
  });
}
