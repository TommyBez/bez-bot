import { listExchangeMessages, listExchanges } from "@shared/store/repo";
import { json } from "@/lib/http";
import { userOr401 } from "@/lib/session";

/**
 * The bot network: every autonomous bot-to-bot exchange for this user, with
 * its messages. Filter by `sessionId` to get the exchanges a conversation
 * started (used to render teammate replies inline in chats and threads).
 */
export async function GET(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "60") || 60, 200);
  let exchanges = await listExchanges(user.id, sessionId ? 300 : limit);
  if (sessionId) exchanges = exchanges.filter((x) => x.originSessionId === sessionId).slice(0, limit);
  const withMessages = await Promise.all(
    exchanges.map(async (exchange) => ({ ...exchange, messages: await listExchangeMessages(exchange.id) })),
  );
  return json({ exchanges: withMessages });
}
