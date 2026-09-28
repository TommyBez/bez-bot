import type { ModelMessage } from "ai";
import type { SessionAuthContext } from "eve/context";
import type { TurnSource } from "../../lib/protocol";
import { getSessionRecord } from "../../lib/store/repo";

/**
 * Who this conversation belongs to (from the session registry, falling back
 * to the auth that created it) and who started the current turn (from the
 * turn's authenticated caller).
 */
export interface TurnIdentity {
  sessionId: string;
  userId: string;
  botId: string;
  kind: "bot" | "group";
  groupId?: string;
  source: TurnSource;
  fromBotId?: string;
  exchangeId?: string;
  messageKind?: "request" | "reply";
  routineId?: string;
  runId?: string;
}

type SessionLike = {
  readonly id: string;
  readonly auth: { readonly current: SessionAuthContext | null; readonly initiator: SessionAuthContext | null };
};

function attrs(auth: SessionAuthContext | null | undefined): Record<string, string> {
  return (auth?.attributes as Record<string, string> | undefined) ?? {};
}

const SOURCES: TurnSource[] = ["user", "teammate", "routine", "group", "system"];

export async function identityForSession(session: SessionLike): Promise<TurnIdentity | null> {
  const record = await getSessionRecord(session.id);
  const initiator = attrs(session.auth.initiator);
  const current = attrs(session.auth.current);
  const userId = record?.userId ?? initiator.userId;
  const botId = record?.botId ?? initiator.botId;
  if (!userId || !botId) return null;
  // The current caller only counts when it is the same user; anything else is ignored.
  const sameUser = current.userId === userId;
  const source = sameUser && SOURCES.includes(current.source as TurnSource) ? (current.source as TurnSource) : "user";
  return {
    sessionId: session.id,
    userId,
    botId,
    kind: record?.kind ?? (initiator.kind === "group" ? "group" : "bot"),
    groupId: record?.groupId ?? initiator.groupId,
    source,
    fromBotId: sameUser ? current.fromBotId : undefined,
    exchangeId: sameUser ? current.exchangeId : undefined,
    messageKind: sameUser && (current.messageKind === "reply" || current.messageKind === "request") ? current.messageKind : undefined,
    routineId: sameUser ? current.routineId : undefined,
    runId: sameUser ? current.runId : undefined,
  };
}

export async function requireIdentity(session: SessionLike): Promise<TurnIdentity> {
  const identity = await identityForSession(session);
  if (!identity) {
    throw new Error("This conversation isn't attached to a Bez Bot. Open the Bot from the Bez Bot app to use its tools.");
  }
  return identity;
}

export function messageText(message: ModelMessage): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (typeof part === "object" && part && "text" in part && typeof part.text === "string" ? part.text : ""))
      .join("\n");
  }
  return "";
}
