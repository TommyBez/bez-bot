import { type AuthFn, ForbiddenError, localDev, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";
import { readCookie, SESSION_COOKIE, verifySessionToken } from "../../lib/auth";
import { CONTEXT_HEADER, decodeClientContext } from "../../lib/protocol";
import { getConversation, getOwnedBot, getSessionContext, getThread, getUser } from "../../lib/store/repo";

function sessionIdFromUrl(request: Request): string | undefined {
  const match = /\/v1\/session\/([^/?]+)/.exec(new URL(request.url).pathname);
  return match ? decodeURIComponent(match[1]!) : undefined;
}

/**
 * `localDev()` lets the eve CLI/TUI in during `eve dev`, but it would also let
 * a cookieless request read any user's session. Keep it to sessions no Bez Bot
 * user owns.
 */
function localDevUnowned(): AuthFn<Request> {
  const fallback = localDev();
  return async (request) => {
    const principal = await fallback(request);
    if (!principal) return principal;
    const sessionId = sessionIdFromUrl(request);
    if (sessionId && (await getSessionContext(sessionId))) {
      throw new ForbiddenError({ message: "Sign in to open this conversation." });
    }
    return principal;
  };
}

/**
 * Browser traffic arrives through the Next.js app on the same origin, so the
 * app's signed session cookie identifies the user. The `x-bezbot-context`
 * header says which bot or thread the conversation belongs to; ownership is
 * checked here and pinned on the session as `auth.initiator.attributes`.
 */
function bezBotSession(): AuthFn<Request> {
  return async (request) => {
    const claims = verifySessionToken(readCookie(request.headers.get("cookie"), SESSION_COOKIE));
    if (!claims) return null;
    const user = await getUser(claims.uid);
    if (!user) return null;

    // eve does not enforce session ownership; do it for id-addressed routes.
    const sessionId = sessionIdFromUrl(request);
    if (sessionId) {
      const owner = await getSessionContext(sessionId);
      if (owner && owner.userId !== user.id) {
        throw new ForbiddenError({ message: "This conversation belongs to someone else." });
      }
    }

    const attributes: Record<string, string> = { userId: user.id, name: user.name, email: user.email };
    const context = decodeClientContext(request.headers.get(CONTEXT_HEADER));

    if (context?.mode === "thread" && context.threadId) {
      const thread = await getThread(context.threadId);
      if (!thread || thread.userId !== user.id) throw new ForbiddenError({ message: "Unknown thread." });
      attributes.mode = "thread";
      attributes.threadId = thread.id;
      attributes.botId = thread.leadBotId;
    } else if (context?.botId) {
      const bot = await getOwnedBot(user.id, context.botId);
      if (!bot) throw new ForbiddenError({ message: "Unknown bot." });
      attributes.mode = context.mode === "teach" ? "teach" : "dm";
      attributes.botId = bot.id;
      if (context.conversationId) {
        const conversation = await getConversation(context.conversationId);
        if (!conversation || conversation.userId !== user.id) {
          throw new ForbiddenError({ message: "Unknown conversation." });
        }
        attributes.conversationId = conversation.id;
      }
    }

    return {
      authenticator: "bezbot",
      principalId: user.id,
      principalType: "user",
      attributes,
    };
  };
}

export default eveChannel({
  auth: [
    bezBotSession(),
    // Lets the eve CLI/TUI reach a deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev`; ignored in production.
    localDevUnowned(),
  ],
});
