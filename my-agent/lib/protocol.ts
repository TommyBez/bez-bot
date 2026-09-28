/**
 * Wire conventions shared by the web app and the eve agent.
 */

/** Header the browser sends with every eve request to say which bot/thread it is talking to. */
export const CONTEXT_HEADER = "x-bezbot-context";
/** Header used by trusted server code (routine dispatch, app actions). */
export const INTERNAL_HEADER = "x-bezbot-internal";

export type ClientSessionMode = "dm" | "thread" | "teach";

export interface ClientSessionContext {
  mode: ClientSessionMode;
  botId?: string;
  threadId?: string;
  conversationId?: string;
}

export function encodeClientContext(context: ClientSessionContext): string {
  const json = JSON.stringify(context);
  return typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    : Buffer.from(json, "utf8").toString("base64url");
}

export function decodeClientContext(value: string | null | undefined): ClientSessionContext | null {
  if (!value) return null;
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as ClientSessionContext;
    if (parsed.mode !== "dm" && parsed.mode !== "thread" && parsed.mode !== "teach") return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Teammate envelope: the first line of a delegated bot-to-bot message names the
// recipient bot so its persona can be loaded inside the child session.
// ---------------------------------------------------------------------------

export interface TeammateEnvelope {
  userId: string;
  botId: string;
  fromBotId: string;
  exchangeId: string;
  depth: number;
  threadId?: string;
}

const ENVELOPE_RE = /<bezbot-teammate\s+([^>]*)\/>/;

export function formatTeammateMessage(envelope: TeammateEnvelope, fromName: string, text: string): string {
  const attrs = Object.entries(envelope)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, "")}"`)
    .join(" ");
  return `<bezbot-teammate ${attrs}/>\nMessage from your teammate ${fromName}:\n\n${text}`;
}

export function parseTeammateEnvelope(text: string | null | undefined): TeammateEnvelope | null {
  if (!text) return null;
  const match = ENVELOPE_RE.exec(text);
  if (!match) return null;
  const attrs: Record<string, string> = {};
  for (const m of match[1]!.matchAll(/(\w+)="([^"]*)"/g)) attrs[m[1]!] = m[2]!;
  if (!attrs.userId || !attrs.botId || !attrs.fromBotId || !attrs.exchangeId) return null;
  return {
    userId: attrs.userId,
    botId: attrs.botId,
    fromBotId: attrs.fromBotId,
    exchangeId: attrs.exchangeId,
    depth: Number(attrs.depth ?? "1") || 1,
    threadId: attrs.threadId || undefined,
  };
}

/** Removes the machine envelope for display. */
export function stripTeammateEnvelope(text: string): string {
  return text.replace(ENVELOPE_RE, "").replace(/^\s*Message from your teammate [^:\n]+:\s*/m, "").trim();
}

/** Routine runs start with this marker so the persona resolver knows the routine. */
export function formatRoutinePrompt(routine: { id: string; name: string; steps: string }, trigger: "schedule" | "manual"): string {
  return [
    `<bezbot-routine id="${routine.id}" trigger="${trigger}"/>`,
    `Run your routine "${routine.name}" now. No one is watching live, so finish the work end to end.`,
    "",
    "Steps:",
    routine.steps,
    "",
    "When you are done, reply with a short report of what you did and anything the user needs to decide.",
  ].join("\n");
}

export function parseRoutineMarker(text: string | null | undefined): { routineId: string; trigger: string } | null {
  if (!text) return null;
  const match = /<bezbot-routine id="([^"]+)" trigger="([^"]+)"\/>/.exec(text);
  return match ? { routineId: match[1]!, trigger: match[2]! } : null;
}

export const MAX_TEAMMATE_DEPTH = 2;
export const BOTNET_MAX_PER_HOUR = 60;
