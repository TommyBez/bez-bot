/**
 * Wire conventions shared by the web app and the eve agent.
 */

/** Header the browser sends with every eve request to say which Bot it is talking to. */
export const CONTEXT_HEADER = "x-bezbot-context";
/** Header carrying a signed delivery credential from trusted server code. */
export const INTERNAL_HEADER = "x-bezbot-internal";

export interface ClientSessionContext {
  botId: string;
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
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as ClientSessionContext;
    return typeof parsed.botId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Turn sources. Every message that reaches a Bot's conversation says where it
// came from. The authenticated source travels in the signed delivery
// credential (see lib/auth.ts); the headers below are only for display and for
// the model's benefit, so a user typing one into their own chat changes
// nothing but how that message looks.
// ---------------------------------------------------------------------------

export type TurnSource = "user" | "teammate" | "routine" | "group" | "system";

/** Claims inside a signed delivery credential. */
export interface DeliveryClaims {
  uid: string;
  bot: string;
  /** Which conversation of the Bot: its own chat, or its seat in a group. */
  kind: "bot" | "group";
  grp?: string;
  src: TurnSource;
  /** Sending Bot, for teammate messages. */
  from?: string;
  xch?: string;
  mk?: "request" | "reply";
  rtn?: string;
  run?: string;
  exp: number;
}

function attr(value: string): string {
  return value.replace(/["<>\n]/g, " ").trim();
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of raw.matchAll(/(\w+)="([^"]*)"/g)) attrs[m[1]!] = m[2]!;
  return attrs;
}

// --- Messages between Bots --------------------------------------------------

export interface TeammateHeader {
  kind: "request" | "reply";
  fromBotId: string;
  fromName: string;
  exchangeId: string;
}

const TEAMMATE_RE = /^<bezbot-from\s+([^>]*)\/>\n?/;

export function formatTeammateMessage(header: TeammateHeader, text: string): string {
  return `<bezbot-from kind="${header.kind}" bot="${attr(header.fromBotId)}" name="${attr(header.fromName)}" exchange="${attr(header.exchangeId)}"/>\n${text}`;
}

export function parseTeammateHeader(text: string | null | undefined): (TeammateHeader & { body: string }) | null {
  if (!text) return null;
  const match = TEAMMATE_RE.exec(text);
  if (!match) return null;
  const a = parseAttrs(match[1]!);
  if (!a.bot || !a.exchange) return null;
  return {
    kind: a.kind === "reply" ? "reply" : "request",
    fromBotId: a.bot,
    fromName: a.name ?? "A teammate",
    exchangeId: a.exchange,
    body: text.slice(match[0].length),
  };
}

// --- Routine runs -------------------------------------------------------------

export interface RoutineHeader {
  routineId: string;
  runId: string;
  name: string;
  trigger: "schedule" | "test" | "webhook";
}

const ROUTINE_RE = /^<bezbot-routine\s+([^>]*)\/>\n?/;

export function formatRoutineMessage(header: RoutineHeader, instruction: string, payload?: string): string {
  return [
    `<bezbot-routine id="${attr(header.routineId)}" run="${attr(header.runId)}" name="${attr(header.name)}" trigger="${header.trigger}"/>`,
    `Run your routine "${header.name}" now and post the result here.`,
    "",
    instruction,
    ...(payload ? ["", "Webhook payload:", "```json", payload, "```"] : []),
  ].join("\n");
}

export function parseRoutineHeader(text: string | null | undefined): (RoutineHeader & { body: string }) | null {
  if (!text) return null;
  const match = ROUTINE_RE.exec(text);
  if (!match) return null;
  const a = parseAttrs(match[1]!);
  if (!a.id) return null;
  const trigger = a.trigger === "test" || a.trigger === "webhook" ? a.trigger : "schedule";
  return { routineId: a.id, runId: a.run ?? "", name: a.name ?? "Routine", trigger, body: text.slice(match[0].length) };
}

// --- Group chats --------------------------------------------------------------

/** A Bot that has nothing to add to a group message answers with exactly this. */
export const NO_REPLY = "NO_REPLY";

export interface GroupHeader {
  groupId: string;
  groupName: string;
  /** must: you were @-mentioned. maybe: decide whether the message is yours. */
  respond: "must" | "maybe";
}

const GROUP_RE = /^<bezbot-group\s+([^>]*)\/>\n?/;

export function formatGroupMessage(header: GroupHeader, lines: { author: string; text: string }[]): string {
  const transcript = lines.map((l) => `**${l.author}:** ${l.text}`).join("\n\n");
  return `<bezbot-group id="${attr(header.groupId)}" name="${attr(header.groupName)}" respond="${header.respond}"/>\n${transcript}`;
}

export function parseGroupHeader(text: string | null | undefined): (GroupHeader & { body: string }) | null {
  if (!text) return null;
  const match = GROUP_RE.exec(text);
  if (!match) return null;
  const a = parseAttrs(match[1]!);
  if (!a.id) return null;
  return { groupId: a.id, groupName: a.name ?? "Group", respond: a.respond === "must" ? "must" : "maybe", body: text.slice(match[0].length) };
}

/** Removes machine headers for display. */
export function stripHeaders(text: string): string {
  return text.replace(TEAMMATE_RE, "").replace(ROUTINE_RE, "").replace(GROUP_RE, "").trim();
}

/** `@Name` mentions resolved against a roster (longest names first). */
export function findMentions(text: string, roster: { id: string; name: string }[]): string[] {
  const lower = text.toLowerCase();
  const hits = new Set<string>();
  for (const bot of [...roster].sort((a, b) => b.name.length - a.name.length)) {
    const needle = `@${bot.name.toLowerCase()}`;
    const compact = `@${bot.name.toLowerCase().replace(/\s+/g, "")}`;
    if (lower.includes(needle) || lower.includes(compact)) hits.add(bot.id);
  }
  return [...hits];
}

export const BOTNET_MAX_PER_HOUR = 60;
