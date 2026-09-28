import { type AuthFn, ForbiddenError, localDev, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";
import { readCookie, SESSION_COOKIE, verifyDelivery, verifySessionToken } from "../../lib/auth";
import { rememberEveOrigin } from "../../lib/delivery";
import { CONTEXT_HEADER, decodeClientContext, INTERNAL_HEADER } from "../../lib/protocol";
import { getOwnedBot, getSessionRecord, getUser } from "../../lib/store/repo";

function sessionIdFromUrl(request: Request): string | undefined {
  const match = /\/v1\/session\/([^/?]+)/.exec(new URL(request.url).pathname);
  return match ? decodeURIComponent(match[1]!) : undefined;
}

function isCreate(request: Request): boolean {
  return request.method === "POST" && /\/v1\/session\/?$/.test(new URL(request.url).pathname);
}

function clean(attributes: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(attributes).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""));
}

/**
 * Server code (routine dispatch, Bot-to-Bot messages, group chats) posts into
 * a Bot's conversation with a signed delivery credential. Its claims become
 * the turn's auth, which is how the Bot knows who a message came from.
 */
function bezBotDelivery(): AuthFn<Request> {
  return async (request) => {
    const token = request.headers.get(INTERNAL_HEADER);
    if (!token) return null;
    const claims = verifyDelivery(token);
    if (!claims) throw new ForbiddenError({ message: "Invalid delivery credential." });
    rememberEveOrigin(request.url);
    const sessionId = sessionIdFromUrl(request);
    if (sessionId) {
      const record = await getSessionRecord(sessionId);
      if (!record || record.userId !== claims.uid || record.botId !== claims.bot) {
        throw new ForbiddenError({ message: "That conversation belongs to another Bot." });
      }
    }
    return {
      authenticator: "bezbot",
      principalId: claims.uid,
      principalType: "user",
      attributes: clean({
        userId: claims.uid,
        botId: claims.bot,
        kind: claims.kind,
        groupId: claims.grp,
        source: claims.src,
        fromBotId: claims.from,
        exchangeId: claims.xch,
        messageKind: claims.mk,
        routineId: claims.rtn,
        runId: claims.run,
      }),
    };
  };
}

/**
 * Browser traffic arrives through the Next.js app on the same origin, so the
 * app's signed session cookie identifies the user. Every Bot has exactly one
 * conversation, created by the app; the browser only reads and writes it.
 */
function bezBotSession(): AuthFn<Request> {
  return async (request) => {
    const claims = verifySessionToken(readCookie(request.headers.get("cookie"), SESSION_COOKIE));
    if (!claims) return null;
    const user = await getUser(claims.uid);
    if (!user) return null;
    rememberEveOrigin(request.url);

    if (isCreate(request)) {
      throw new ForbiddenError({ message: "Open the Bot in Bez Bot to talk to it; each Bot has one conversation." });
    }

    const attributes: Record<string, string | undefined> = { userId: user.id, name: user.name, source: "user" };
    const sessionId = sessionIdFromUrl(request);
    if (sessionId) {
      const record = await getSessionRecord(sessionId);
      if (!record) throw new ForbiddenError({ message: "Unknown conversation." });
      if (record.userId !== user.id) throw new ForbiddenError({ message: "This conversation belongs to someone else." });
      attributes.botId = record.botId;
      attributes.kind = record.kind;
      attributes.groupId = record.groupId;
    } else {
      const context = decodeClientContext(request.headers.get(CONTEXT_HEADER));
      if (context?.botId) {
        const bot = await getOwnedBot(user.id, context.botId);
        if (!bot) throw new ForbiddenError({ message: "Unknown bot." });
        attributes.botId = bot.id;
        attributes.kind = "bot";
      }
    }

    return {
      authenticator: "bezbot",
      principalId: user.id,
      principalType: "user",
      attributes: clean(attributes),
    };
  };
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
    if (sessionId && (await getSessionRecord(sessionId))) {
      throw new ForbiddenError({ message: "Sign in to open this conversation." });
    }
    return principal;
  };
}

export default eveChannel({
  auth: [
    bezBotDelivery(),
    bezBotSession(),
    // Lets the eve CLI/TUI reach a deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev`; ignored in production.
    localDevUnowned(),
  ],
});
