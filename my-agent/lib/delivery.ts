import { readFileSync } from "node:fs";
import path from "node:path";
import { signDelivery } from "./auth";
import { type DeliveryClaims, INTERNAL_HEADER } from "./protocol";
import { claimOnce, getBot, getGroup, registerSession, setBotSession, setGroupSession } from "./store/repo";
import { findProjectRoot, kv } from "./store/kv";
import type { Bot, Group } from "./store/types";

/**
 * Server-side delivery into a Bot's conversation. Every Bot has exactly one
 * durable eve session (and one per group it belongs to). Routine runs,
 * messages from other Bots, and group traffic are posted into those sessions
 * through the eve HTTP API with a signed delivery credential, so they show up
 * in the same conversation the user reads.
 */

let learnedOrigin: string | undefined;

/** The eve channel reports its own loopback origin here as requests arrive. */
export function rememberEveOrigin(requestUrl: string): void {
  try {
    const url = new URL(requestUrl);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") learnedOrigin = url.origin;
  } catch {
    // ignore
  }
}

/** The eve dev server `withEve` started, if that process is still running. */
function devServerOrigin(): string | undefined {
  try {
    const file = path.join(findProjectRoot(), ".eve", "next-dev-server.json");
    const entry = JSON.parse(readFileSync(file, "utf8")) as { origin?: string; pid?: number | null };
    if (!entry.origin) return undefined;
    if (typeof entry.pid === "number") process.kill(entry.pid, 0); // throws when the process is gone
    return new URL(entry.origin).origin;
  } catch {
    return undefined;
  }
}

/** Where the eve runtime answers `/eve/v1/**`, from either the web app or the agent. */
export function eveOrigin(): string {
  const explicit = process.env.BEZBOT_EVE_ORIGIN ?? process.env.EVE_BASE_URL;
  if (explicit) return new URL(explicit).origin;
  if (process.env.VERCEL === "1" && process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return learnedOrigin ?? devServerOrigin() ?? `http://127.0.0.1:${process.env.EVE_NEXT_PRODUCTION_PORT ?? "4274"}`;
}

type Claims = Omit<DeliveryClaims, "exp">;

async function eveRequest(route: string, claims: Claims, body: Record<string, unknown>): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    [INTERNAL_HEADER]: signDelivery(claims),
  };
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }
  return fetch(`${eveOrigin()}/eve/v1${route}`, { method: "POST", headers, body: JSON.stringify(body) });
}

async function createSession(claims: Claims, operationId: string): Promise<string> {
  const response = await eveRequest("/session", claims, { operationId });
  const data = (await response.json().catch(() => null)) as { sessionId?: string; error?: string } | null;
  if (!response.ok || !data?.sessionId) {
    throw new Error(`Couldn't start the conversation (${response.status}${data?.error ? `: ${data.error}` : ""}).`);
  }
  return data.sessionId;
}

/** The Bot's one conversation, created on first use. */
export async function ensureBotSession(bot: Bot): Promise<string> {
  if (bot.sessionId) return bot.sessionId;
  const claims: Claims = { uid: bot.userId, bot: bot.id, kind: "bot", src: "system" };
  // A new operation id after a reset keeps eve from handing back the retired session.
  const generation = (await kv().get<number>(`bot-session-gen:${bot.id}`)) ?? 0;
  const sessionId = await createSession(claims, `bot-session:${bot.id}:${generation}`);
  await registerSession({ sessionId, userId: bot.userId, botId: bot.id, kind: "bot" });
  return (await setBotSession(bot.id, sessionId)) ?? sessionId;
}

/** A Bot's seat in a group chat: its own session for that group. */
export async function ensureGroupSession(group: Group, bot: Bot): Promise<string> {
  const existing = group.sessions[bot.id];
  if (existing) return existing;
  const claims: Claims = { uid: group.userId, bot: bot.id, kind: "group", grp: group.id, src: "system" };
  const sessionId = await createSession(claims, `group-session:${group.id}:${bot.id}`);
  await registerSession({ sessionId, userId: group.userId, botId: bot.id, kind: "group", groupId: group.id });
  return (await setGroupSession(group.id, bot.id, sessionId)) ?? sessionId;
}

export interface Delivery {
  text: string;
  claims: Pick<Claims, "src" | "from" | "xch" | "mk" | "rtn" | "run">;
  /** Deliveries wait for the Bot's current turn; your own messages steer it instead. */
  turnPolicy?: "queue" | "steer";
  /** Stable key so a retried step doesn't post the same message twice. */
  dedupeKey?: string;
}

async function post(sessionId: string, claims: Claims, delivery: Delivery): Promise<void> {
  // A session created a moment ago may still be starting; wait for it rather than drop the message.
  for (let attempt = 0; ; attempt += 1) {
    const response = await eveRequest(`/session/${encodeURIComponent(sessionId)}`, claims, {
      message: delivery.text,
      turnPolicy: delivery.turnPolicy ?? "queue",
    });
    if (response.ok) return;
    const detail = await response.text().catch(() => "");
    if (response.status === 409 && detail.includes("session_not_ready") && attempt < 20) {
      await new Promise((resolve) => setTimeout(resolve, 250 + attempt * 250));
      continue;
    }
    throw new Error(`Delivery failed (${response.status}) ${detail.slice(0, 200)}`);
  }
}

export async function deliverToBot(botId: string, delivery: Delivery): Promise<string> {
  const bot = await getBot(botId);
  if (!bot) throw new Error("That Bot no longer exists.");
  if (delivery.dedupeKey && !(await claimOnce(`delivery:${delivery.dedupeKey}`))) return bot.sessionId ?? "";
  const sessionId = await ensureBotSession(bot);
  await post(sessionId, { ...delivery.claims, uid: bot.userId, bot: bot.id, kind: "bot" }, delivery);
  return sessionId;
}

export async function deliverToGroupSeat(groupId: string, botId: string, delivery: Delivery): Promise<string> {
  const [group, bot] = await Promise.all([getGroup(groupId), getBot(botId)]);
  if (!group || !bot || !group.memberBotIds.includes(botId)) throw new Error("That Bot isn't in this group.");
  if (delivery.dedupeKey && !(await claimOnce(`delivery:${delivery.dedupeKey}`))) return group.sessions[botId] ?? "";
  const sessionId = await ensureGroupSession(group, bot);
  await post(sessionId, { ...delivery.claims, uid: group.userId, bot: bot.id, kind: "group", grp: group.id }, delivery);
  return sessionId;
}
