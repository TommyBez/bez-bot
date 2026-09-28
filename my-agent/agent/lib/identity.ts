import type { ModelMessage } from "ai";
import type { SessionAuthContext } from "eve/context";
import { verifyTeammateEnvelope } from "../../lib/auth";
import { parseRoutineMarker, parseTeammateEnvelope, type TeammateEnvelope } from "../../lib/protocol";
import { getSessionContext } from "../../lib/store/repo";
import type { SessionContextRecord } from "../../lib/store/types";

export type SessionMode = SessionContextRecord["mode"];

export interface BotIdentity {
  userId: string;
  botId: string;
  mode: SessionMode;
  threadId?: string;
  conversationId?: string;
  routineId?: string;
  exchangeId?: string;
  fromBotId?: string;
  depth: number;
}

function attr(auth: SessionAuthContext | null | undefined, key: string): string | undefined {
  const value = auth?.attributes?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Identity carried on route auth (browser sessions and scheduled routine runs). */
export function identityFromAuth(auth: SessionAuthContext | null | undefined): BotIdentity | null {
  const userId = attr(auth, "userId");
  const botId = attr(auth, "botId");
  if (!userId || !botId) return null;
  const mode = (attr(auth, "mode") ?? "dm") as SessionMode;
  return {
    userId,
    botId,
    mode,
    threadId: attr(auth, "threadId"),
    conversationId: attr(auth, "conversationId"),
    routineId: attr(auth, "routineId"),
    depth: 0,
  };
}

export function messageText(message: ModelMessage): string {
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";
  return message.content
    .map((part) => (part && typeof part === "object" && "type" in part && part.type === "text" ? String(part.text) : ""))
    .join("\n");
}

/** The most recent teammate envelope in the visible history (teammate sessions only). */
/** A teammate envelope minted by `message_bot`; unsigned or tampered ones are ignored. */
export function verifiedTeammateEnvelope(text: string | null | undefined): TeammateEnvelope | null {
  const envelope = parseTeammateEnvelope(text);
  return envelope && verifyTeammateEnvelope(envelope) ? envelope : null;
}

export function envelopeFromMessages(messages: readonly ModelMessage[]): TeammateEnvelope | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (message.role !== "user") continue;
    const envelope = verifiedTeammateEnvelope(messageText(message));
    if (envelope) return envelope;
  }
  return null;
}

export function routineFromMessages(messages: readonly ModelMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (message.role !== "user") continue;
    const marker = parseRoutineMarker(messageText(message));
    if (marker) return marker.routineId;
  }
  return undefined;
}

export function identityFromEnvelope(envelope: TeammateEnvelope): BotIdentity {
  return {
    userId: envelope.userId,
    botId: envelope.botId,
    mode: "teammate",
    threadId: envelope.threadId,
    exchangeId: envelope.exchangeId,
    fromBotId: envelope.fromBotId,
    depth: envelope.depth,
  };
}

/**
 * Identity for tool executors. Hooks register every session in the store when
 * it starts (root) or receives a teammate message (child), so tools look it up
 * by session id and fall back to route auth.
 */
export async function identityForSession(session: {
  readonly id: string;
  readonly auth: { readonly current: SessionAuthContext | null; readonly initiator: SessionAuthContext | null };
}): Promise<BotIdentity | null> {
  const record = await getSessionContext(session.id);
  if (record) {
    return {
      userId: record.userId,
      botId: record.botId,
      mode: record.mode,
      threadId: record.threadId,
      conversationId: record.conversationId,
      routineId: record.routineId,
      exchangeId: record.exchangeId,
      fromBotId: record.fromBotId,
      depth: record.depth,
    };
  }
  return identityFromAuth(session.auth.initiator) ?? identityFromAuth(session.auth.current);
}

export async function requireIdentity(session: Parameters<typeof identityForSession>[0]): Promise<BotIdentity> {
  const identity = await identityForSession(session);
  if (!identity) {
    throw new Error(
      "This session is not attached to a Bez Bot. Open the bot from the Bez Bot app to use team tools.",
    );
  }
  return identity;
}
