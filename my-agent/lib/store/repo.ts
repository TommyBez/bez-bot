import { newId, nowIso } from "../ids";
import { computeNextRun } from "../schedule";
import { getTemplate } from "../templates";
import { kv } from "./kv";
import type {
  Bot,
  BotnetExchange,
  BotnetMessage,
  ComputerActivity,
  ComputerState,
  Conversation,
  InboxItem,
  MemoryDoc,
  MemoryEntry,
  Routine,
  RoutineSchedule,
  SessionContextRecord,
  TeachRecording,
  Thread,
  User,
  VaultEntry,
} from "./types";

// ---------------------------------------------------------------------------
// Index helpers: small per-user id lists stored beside the records.
// ---------------------------------------------------------------------------

async function addToIndex(key: string, id: string, front = true): Promise<void> {
  await kv().update<string[]>(key, (ids) => {
    const list = (ids ?? []).filter((x) => x !== id);
    return front ? [id, ...list] : [...list, id];
  });
}

async function removeFromIndex(key: string, id: string): Promise<void> {
  await kv().update<string[]>(key, (ids) => (ids ?? []).filter((x) => x !== id));
}

async function loadMany<T>(prefix: string, ids: string[]): Promise<T[]> {
  const rows = await Promise.all(ids.map((id) => kv().get<T>(`${prefix}:${id}`)));
  return rows.filter((row): row is Awaited<T> & T => row !== null);
}

async function pushCapped<T>(key: string, item: T, cap: number): Promise<void> {
  await kv().update<T[]>(key, (items) => [item, ...(items ?? [])].slice(0, cap));
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getUser(id: string): Promise<User | null> {
  return kv().get<User>(`user:${id}`);
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const id = await kv().get<string>(`user-email:${email.trim().toLowerCase()}`);
  return id ? getUser(id) : null;
}

export async function createUser(input: { name: string; email: string; timezone?: string }): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  const user: User = {
    id: newId("usr"),
    name: input.name.trim() || email.split("@")[0] || "You",
    email,
    createdAt: nowIso(),
    plan: "free",
    timezone: input.timezone,
  };
  await kv().set(`user:${user.id}`, user);
  await kv().set(`user-email:${email}`, user.id);
  return user;
}

export async function updateUser(id: string, patch: Partial<Pick<User, "name" | "timezone" | "plan">>): Promise<User | null> {
  return kv().update<User>(`user:${id}`, (user) => (user ? { ...user, ...patch } : null));
}

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

const BOT_COLORS = ["#3b82f6", "#a855f7", "#f97316", "#22c55e", "#06b6d4", "#ef4444", "#ec4899", "#eab308", "#14b8a6"];

export async function listBots(userId: string): Promise<Bot[]> {
  const ids = (await kv().get<string[]>(`idx:${userId}:bots`)) ?? [];
  const bots = await loadMany<Bot>("bot", ids);
  return bots.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getBot(id: string): Promise<Bot | null> {
  return kv().get<Bot>(`bot:${id}`);
}

export async function getOwnedBot(userId: string, botId: string): Promise<Bot | null> {
  const bot = await getBot(botId);
  return bot && bot.userId === userId ? bot : null;
}

export interface CreateBotInput {
  name: string;
  job?: string;
  description?: string;
  instructions?: string;
  emoji?: string;
  color?: string;
  templateId?: string;
  autoReview?: Bot["autoReview"];
  autonomous?: boolean;
  installRoutines?: boolean;
}

export async function createBot(userId: string, input: CreateBotInput, timezone = "UTC"): Promise<Bot> {
  const template = getTemplate(input.templateId);
  const existing = await listBots(userId);
  const now = nowIso();
  const bot: Bot = {
    id: newId("bot"),
    userId,
    name: input.name.trim() || template?.name || "New Bot",
    job: input.job?.trim() || template?.job || "Give it any job.",
    description: input.description?.trim() || template?.description || "",
    instructions: input.instructions ?? template?.instructions ?? "",
    emoji: input.emoji || template?.emoji || "🤖",
    color: input.color || template?.color || BOT_COLORS[existing.length % BOT_COLORS.length]!,
    templateId: template?.id,
    autoReview: input.autoReview ?? "auto",
    allowedPeers: [],
    autonomous: input.autonomous ?? true,
    status: "idle",
    createdAt: now,
    updatedAt: now,
  };
  await kv().set(`bot:${bot.id}`, bot);
  await addToIndex(`idx:${userId}:bots`, bot.id, false);
  if (template && input.installRoutines !== false) {
    for (const r of template.routines) {
      await createRoutine(userId, {
        botId: bot.id,
        name: r.name,
        description: r.description,
        steps: r.steps,
        source: "template",
        schedule: r.schedule ? { ...r.schedule, timezone } : null,
        // Template routines start paused so nothing runs before the user opts in.
        enabled: false,
      });
    }
  }
  return bot;
}

export async function updateBot(
  userId: string,
  botId: string,
  patch: Partial<
    Pick<Bot, "name" | "job" | "description" | "instructions" | "emoji" | "color" | "autoReview" | "allowedPeers" | "autonomous" | "shareId">
  >,
): Promise<Bot | null> {
  return kv().update<Bot>(`bot:${botId}`, (bot) =>
    bot && bot.userId === userId ? { ...bot, ...patch, updatedAt: nowIso() } : bot,
  );
}

export async function setBotStatus(botId: string, status: Bot["status"], statusText?: string): Promise<void> {
  await kv().update<Bot>(`bot:${botId}`, (bot) =>
    bot ? { ...bot, status, statusText, lastActiveAt: nowIso() } : null,
  );
}

export async function deleteBot(userId: string, botId: string): Promise<boolean> {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return false;
  await kv().del(`bot:${botId}`);
  await removeFromIndex(`idx:${userId}:bots`, botId);
  for (const routine of await listRoutines(userId, botId)) await deleteRoutine(userId, routine.id);
  await kv().del(`mem:${userId}:${botId}`);
  if (bot.shareId) await kv().del(`share:${bot.shareId}`);
  return true;
}

// ---------------------------------------------------------------------------
// Public sharing: x.ai/bot/<id> style pages.
// ---------------------------------------------------------------------------

export interface SharedBot {
  shareId: string;
  name: string;
  job: string;
  description: string;
  instructions: string;
  emoji: string;
  color: string;
  templateId?: string;
  authorName: string;
  routines: { name: string; description: string; steps: string; schedule: Routine["schedule"] }[];
  createdAt: string;
  adds: number;
}

export async function shareBot(userId: string, botId: string): Promise<SharedBot | null> {
  const bot = await getOwnedBot(userId, botId);
  const user = await getUser(userId);
  if (!bot || !user) return null;
  const shareId = bot.shareId ?? newId("b", 18).slice(2);
  const routines = await listRoutines(userId, botId);
  const shared: SharedBot = {
    shareId,
    name: bot.name,
    job: bot.job,
    description: bot.description,
    instructions: bot.instructions,
    emoji: bot.emoji,
    color: bot.color,
    templateId: bot.templateId,
    authorName: user.name,
    routines: routines.map((r) => ({ name: r.name, description: r.description, steps: r.steps, schedule: r.schedule })),
    createdAt: nowIso(),
    adds: (await kv().get<SharedBot>(`share:${shareId}`))?.adds ?? 0,
  };
  await kv().set(`share:${shareId}`, shared);
  await updateBot(userId, botId, { shareId });
  return shared;
}

export async function getSharedBot(shareId: string): Promise<SharedBot | null> {
  return kv().get<SharedBot>(`share:${shareId}`);
}

export async function addSharedBot(userId: string, shareId: string, timezone = "UTC"): Promise<Bot | null> {
  const shared = await getSharedBot(shareId);
  if (!shared) return null;
  const bot = await createBot(
    userId,
    {
      name: shared.name,
      job: shared.job,
      description: shared.description,
      instructions: shared.instructions,
      emoji: shared.emoji,
      color: shared.color,
      installRoutines: false,
    },
    timezone,
  );
  for (const r of shared.routines) {
    await createRoutine(userId, {
      botId: bot.id,
      name: r.name,
      description: r.description,
      steps: r.steps,
      source: "template",
      schedule: r.schedule ? { ...r.schedule, timezone } : null,
      enabled: false,
    });
  }
  await kv().update<SharedBot>(`share:${shareId}`, (s) => (s ? { ...s, adds: s.adds + 1 } : null));
  return bot;
}

// ---------------------------------------------------------------------------
// Conversations (1:1 with a bot)
// ---------------------------------------------------------------------------

export async function listConversations(userId: string, botId?: string): Promise<Conversation[]> {
  const ids = (await kv().get<string[]>(`idx:${userId}:convs`)) ?? [];
  const convs = await loadMany<Conversation>("conv", ids);
  return convs
    .filter((c) => (botId ? c.botId === botId : true))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getConversation(id: string): Promise<Conversation | null> {
  return kv().get<Conversation>(`conv:${id}`);
}

export async function createConversation(
  userId: string,
  botId: string,
  input: { title?: string; mode?: Conversation["mode"]; sessionId?: string } = {},
): Promise<Conversation> {
  const now = nowIso();
  const conv: Conversation = {
    id: newId("conv"),
    userId,
    botId,
    title: input.title ?? "New task",
    mode: input.mode ?? "dm",
    sessionId: input.sessionId,
    createdAt: now,
    updatedAt: now,
  };
  await kv().set(`conv:${conv.id}`, conv);
  await addToIndex(`idx:${userId}:convs`, conv.id);
  return conv;
}

export async function updateConversation(
  userId: string,
  id: string,
  patch: Partial<Pick<Conversation, "title" | "sessionId">>,
): Promise<Conversation | null> {
  const updated = await kv().update<Conversation>(`conv:${id}`, (c) =>
    c && c.userId === userId ? { ...c, ...patch, updatedAt: nowIso() } : c,
  );
  if (updated && updated.userId === userId) await addToIndex(`idx:${userId}:convs`, id);
  return updated;
}

export async function touchConversationBySession(sessionId: string, title?: string): Promise<void> {
  const ctx = await getSessionContext(sessionId);
  if (!ctx?.conversationId) return;
  await kv().update<Conversation>(`conv:${ctx.conversationId}`, (c) =>
    c
      ? {
          ...c,
          sessionId: c.sessionId ?? sessionId,
          title: c.title === "New task" && title ? title : c.title,
          updatedAt: nowIso(),
        }
      : null,
  );
  await addToIndex(`idx:${ctx.userId}:convs`, ctx.conversationId);
}

export async function deleteConversation(userId: string, id: string): Promise<void> {
  const conv = await getConversation(id);
  if (!conv || conv.userId !== userId) return;
  await kv().del(`conv:${id}`);
  await removeFromIndex(`idx:${userId}:convs`, id);
}

// ---------------------------------------------------------------------------
// Threads (several bots in one conversation)
// ---------------------------------------------------------------------------

export async function listThreads(userId: string): Promise<Thread[]> {
  const ids = (await kv().get<string[]>(`idx:${userId}:threads`)) ?? [];
  const threads = await loadMany<Thread>("thread", ids);
  return threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getThread(id: string): Promise<Thread | null> {
  return kv().get<Thread>(`thread:${id}`);
}

export async function createThread(
  userId: string,
  input: { title?: string; memberBotIds: string[]; leadBotId?: string },
): Promise<Thread> {
  const bots = await listBots(userId);
  const members = input.memberBotIds.filter((id) => bots.some((b) => b.id === id));
  if (members.length === 0) throw new Error("A thread needs at least one of your bots.");
  const lead = input.leadBotId && members.includes(input.leadBotId) ? input.leadBotId : members[0]!;
  const names = members.map((id) => bots.find((b) => b.id === id)?.name).filter(Boolean);
  const now = nowIso();
  const thread: Thread = {
    id: newId("thr"),
    userId,
    title: input.title?.trim() || names.join(", "),
    memberBotIds: members,
    leadBotId: lead,
    createdAt: now,
    updatedAt: now,
  };
  await kv().set(`thread:${thread.id}`, thread);
  await addToIndex(`idx:${userId}:threads`, thread.id);
  return thread;
}

export async function updateThread(
  userId: string,
  id: string,
  patch: Partial<Pick<Thread, "title" | "memberBotIds" | "leadBotId" | "sessionId">>,
): Promise<Thread | null> {
  return kv().update<Thread>(`thread:${id}`, (t) =>
    t && t.userId === userId ? { ...t, ...patch, updatedAt: nowIso() } : t,
  );
}

export async function deleteThread(userId: string, id: string): Promise<void> {
  const thread = await getThread(id);
  if (!thread || thread.userId !== userId) return;
  await kv().del(`thread:${id}`);
  await removeFromIndex(`idx:${userId}:threads`, id);
}

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

export async function listRoutines(userId: string, botId?: string): Promise<Routine[]> {
  const ids = (await kv().get<string[]>(`idx:${userId}:routines`)) ?? [];
  const routines = await loadMany<Routine>("routine", ids);
  return routines
    .filter((r) => (botId ? r.botId === botId : true))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getRoutine(id: string): Promise<Routine | null> {
  return kv().get<Routine>(`routine:${id}`);
}

export interface RoutineInput {
  botId: string;
  name: string;
  description?: string;
  steps: string;
  source?: Routine["source"];
  schedule?: RoutineSchedule | null;
  enabled?: boolean;
}

export async function createRoutine(userId: string, input: RoutineInput): Promise<Routine> {
  const bot = await getOwnedBot(userId, input.botId);
  if (!bot) throw new Error("Unknown bot.");
  const now = nowIso();
  const schedule = input.schedule ?? null;
  const enabled = input.enabled ?? true;
  const routine: Routine = {
    id: newId("rtn"),
    userId,
    botId: input.botId,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    steps: input.steps.trim(),
    source: input.source ?? "manual",
    schedule,
    enabled,
    nextRunAt: enabled ? (computeNextRun(schedule)?.toISOString() ?? null) : null,
    runCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await kv().set(`routine:${routine.id}`, routine);
  await addToIndex(`idx:${userId}:routines`, routine.id, false);
  await syncDueIndex(routine);
  return routine;
}

export async function updateRoutine(
  userId: string,
  id: string,
  patch: Partial<Pick<Routine, "name" | "description" | "steps" | "schedule" | "enabled">>,
): Promise<Routine | null> {
  const updated = await kv().update<Routine>(`routine:${id}`, (r) => {
    if (!r || r.userId !== userId) return r;
    const next: Routine = { ...r, ...patch, updatedAt: nowIso() };
    if ("schedule" in patch || "enabled" in patch) {
      next.nextRunAt = next.enabled ? (computeNextRun(next.schedule)?.toISOString() ?? null) : null;
    }
    return next;
  });
  if (updated && updated.userId === userId) await syncDueIndex(updated);
  return updated && updated.userId === userId ? updated : null;
}

export async function deleteRoutine(userId: string, id: string): Promise<boolean> {
  const routine = await getRoutine(id);
  if (!routine || routine.userId !== userId) return false;
  await kv().del(`routine:${id}`);
  await removeFromIndex(`idx:${userId}:routines`, id);
  await removeFromIndex("idx:routines-scheduled", id);
  return true;
}

/** Global index of routines with a future `nextRunAt`, scanned by the dispatcher. */
async function syncDueIndex(routine: Routine): Promise<void> {
  if (routine.enabled && routine.nextRunAt) await addToIndex("idx:routines-scheduled", routine.id, false);
  else await removeFromIndex("idx:routines-scheduled", routine.id);
}

/**
 * Atomically leases routines whose `nextRunAt` has passed. The lease stops
 * overlapping dispatcher ticks from starting the same run twice.
 */
export async function claimDueRoutines(options: { now?: Date; limit?: number; leaseMs?: number } = {}): Promise<Routine[]> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 25;
  const leaseMs = options.leaseMs ?? 5 * 60_000;
  const ids = (await kv().get<string[]>("idx:routines-scheduled")) ?? [];
  const claimed: Routine[] = [];
  for (const id of ids) {
    if (claimed.length >= limit) break;
    let won = false;
    const routine = await kv().update<Routine>(`routine:${id}`, (r) => {
      if (!r || !r.enabled || !r.nextRunAt) return r;
      if (new Date(r.nextRunAt).getTime() > now.getTime()) return r;
      if (r.leaseUntil && new Date(r.leaseUntil).getTime() > now.getTime()) return r;
      won = true;
      return { ...r, leaseUntil: new Date(now.getTime() + leaseMs).toISOString(), lastStatus: "queued" };
    });
    if (won && routine) claimed.push(routine);
  }
  return claimed;
}

export async function markRoutineStarted(id: string, sessionId: string | null): Promise<void> {
  const updated = await kv().update<Routine>(`routine:${id}`, (r) => {
    if (!r) return null;
    const next = computeNextRun(r.schedule, new Date());
    return {
      ...r,
      lastRunAt: nowIso(),
      lastStatus: "running",
      lastSessionId: sessionId,
      runCount: r.runCount + 1,
      leaseUntil: null,
      nextRunAt: r.enabled && next ? next.toISOString() : null,
      enabled: r.schedule ? r.enabled : r.enabled,
    };
  });
  if (updated) await syncDueIndex(updated);
}

export async function markRoutineFinished(id: string, status: "succeeded" | "failed"): Promise<void> {
  await kv().update<Routine>(`routine:${id}`, (r) => (r ? { ...r, lastStatus: status } : null));
}

export async function releaseRoutine(id: string, retryAt: Date): Promise<void> {
  await kv().update<Routine>(`routine:${id}`, (r) =>
    r ? { ...r, leaseUntil: null, lastStatus: "failed", nextRunAt: retryAt.toISOString() } : null,
  );
}

/** Queue an on-demand run: the dispatcher picks it up on its next tick. */
export async function queueRoutineNow(userId: string, id: string): Promise<Routine | null> {
  const updated = await kv().update<Routine>(`routine:${id}`, (r) =>
    r && r.userId === userId ? { ...r, enabled: true, nextRunAt: nowIso(), leaseUntil: null } : r,
  );
  if (updated && updated.userId === userId) {
    await syncDueIndex(updated);
    return updated;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Memory: one document per bot, plus a team document shared by every bot.
// ---------------------------------------------------------------------------

export const TEAM_MEMORY = "team";
const MAX_MEMORY_ENTRIES = 200;

function memoryKey(userId: string, botId: string): string {
  return `mem:${userId}:${botId}`;
}

export async function getMemory(userId: string, botId: string): Promise<MemoryDoc> {
  return (await kv().get<MemoryDoc>(memoryKey(userId, botId))) ?? { entries: [], version: 0, updatedAt: nowIso() };
}

export async function addMemory(
  userId: string,
  botId: string,
  input: { text: string; source: MemoryEntry["source"]; authorBotId?: string },
): Promise<MemoryEntry | null> {
  const text = input.text.replace(/\s+/g, " ").trim().slice(0, 1200);
  if (!text) return null;
  let saved: MemoryEntry | null = null;
  await kv().update<MemoryDoc>(memoryKey(userId, botId), (doc) => {
    const current = doc ?? { entries: [], version: 0, updatedAt: nowIso() };
    const duplicate = current.entries.find((e) => e.text.toLowerCase() === text.toLowerCase());
    if (duplicate) {
      saved = duplicate;
      return current;
    }
    saved = { id: newId("mem", 10), text, source: input.source, authorBotId: input.authorBotId, createdAt: nowIso() };
    return {
      entries: [...current.entries, saved].slice(-MAX_MEMORY_ENTRIES),
      version: current.version + 1,
      updatedAt: nowIso(),
    };
  });
  return saved;
}

export async function removeMemory(userId: string, botId: string, entryId: string): Promise<boolean> {
  let removed = false;
  await kv().update<MemoryDoc>(memoryKey(userId, botId), (doc) => {
    if (!doc) return null;
    const entries = doc.entries.filter((e) => e.id !== entryId);
    removed = entries.length !== doc.entries.length;
    return { entries, version: doc.version + (removed ? 1 : 0), updatedAt: nowIso() };
  });
  return removed;
}

export async function editMemory(userId: string, botId: string, entryId: string, text: string): Promise<boolean> {
  let edited = false;
  await kv().update<MemoryDoc>(memoryKey(userId, botId), (doc) => {
    if (!doc) return null;
    const entries = doc.entries.map((e) => {
      if (e.id !== entryId) return e;
      edited = true;
      return { ...e, text: text.trim().slice(0, 1200), source: "user" as const };
    });
    return { entries, version: doc.version + 1, updatedAt: nowIso() };
  });
  return edited;
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

export async function listInbox(userId: string): Promise<InboxItem[]> {
  return (await kv().get<InboxItem[]>(`inbox:${userId}`)) ?? [];
}

export async function pushInbox(item: Omit<InboxItem, "id" | "createdAt" | "read">): Promise<InboxItem> {
  const full: InboxItem = { ...item, id: newId("ibx", 10), read: false, createdAt: nowIso() };
  await pushCapped(`inbox:${item.userId}`, full, 200);
  return full;
}

export async function markInboxRead(userId: string, ids: string[] | "all"): Promise<void> {
  await kv().update<InboxItem[]>(`inbox:${userId}`, (items) =>
    (items ?? []).map((item) => (ids === "all" || ids.includes(item.id) ? { ...item, read: true } : item)),
  );
}

// ---------------------------------------------------------------------------
// Botnet: autonomous bot-to-bot messages
// ---------------------------------------------------------------------------

export async function createExchange(
  input: Omit<BotnetExchange, "id" | "createdAt" | "updatedAt" | "status"> & { id?: string },
): Promise<BotnetExchange> {
  const now = nowIso();
  const exchange: BotnetExchange = { ...input, id: input.id ?? newId("xch"), status: "working", createdAt: now, updatedAt: now };
  await kv().set(`xch:${exchange.id}`, exchange);
  await addToIndex(`idx:${input.userId}:exchanges`, exchange.id);
  await kv().update<string[]>(`idx:${input.userId}:exchanges`, (ids) => (ids ?? []).slice(0, 300));
  return exchange;
}

export async function updateExchange(id: string, patch: Partial<BotnetExchange>): Promise<BotnetExchange | null> {
  return kv().update<BotnetExchange>(`xch:${id}`, (x) => (x ? { ...x, ...patch, updatedAt: nowIso() } : null));
}

export async function getExchange(id: string): Promise<BotnetExchange | null> {
  return kv().get<BotnetExchange>(`xch:${id}`);
}

export async function listExchanges(userId: string, limit = 100): Promise<BotnetExchange[]> {
  const ids = ((await kv().get<string[]>(`idx:${userId}:exchanges`)) ?? []).slice(0, limit);
  return loadMany<BotnetExchange>("xch", ids);
}

export async function appendBotnetMessage(message: Omit<BotnetMessage, "id" | "createdAt">): Promise<BotnetMessage> {
  const full: BotnetMessage = { ...message, id: newId("bnm", 10), createdAt: nowIso() };
  await kv().update<BotnetMessage[]>(`xch-msgs:${message.exchangeId}`, (items) => [...(items ?? []), full].slice(-100));
  await pushCapped(`botnet:${message.userId}`, full, 500);
  return full;
}

export async function listBotnetMessages(userId: string, limit = 200): Promise<BotnetMessage[]> {
  return ((await kv().get<BotnetMessage[]>(`botnet:${userId}`)) ?? []).slice(0, limit);
}

export async function listExchangeMessages(exchangeId: string): Promise<BotnetMessage[]> {
  return (await kv().get<BotnetMessage[]>(`xch-msgs:${exchangeId}`)) ?? [];
}

/** Per-user sliding window so autonomous chatter can't run away. */
export async function consumeBotnetBudget(userId: string, maxPerHour: number): Promise<boolean> {
  const hour = new Date().toISOString().slice(0, 13);
  let allowed = false;
  await kv().update<{ hour: string; count: number }>(`botnet-budget:${userId}`, (b) => {
    const current = b && b.hour === hour ? b : { hour, count: 0 };
    if (current.count >= maxPerHour) return current;
    allowed = true;
    return { hour, count: current.count + 1 };
  });
  return allowed;
}

// ---------------------------------------------------------------------------
// Session registry
// ---------------------------------------------------------------------------

export async function registerSession(
  record: Omit<SessionContextRecord, "createdAt">,
  options: { upsert?: boolean } = {},
): Promise<SessionContextRecord> {
  const existing = await getSessionContext(record.sessionId);
  if (existing && !options.upsert) return existing;
  if (existing && options.upsert) {
    const merged: SessionContextRecord = { ...existing, ...record, createdAt: existing.createdAt };
    await kv().set(`sess:${record.sessionId}`, merged);
    return merged;
  }
  const full: SessionContextRecord = { ...record, createdAt: nowIso() };
  await kv().set(`sess:${record.sessionId}`, full);
  await pushCapped(`sessions:${record.userId}:${record.botId}`, record.sessionId, 100);
  return full;
}

export async function getSessionContext(sessionId: string): Promise<SessionContextRecord | null> {
  return kv().get<SessionContextRecord>(`sess:${sessionId}`);
}

// ---------------------------------------------------------------------------
// Vault (credentials the bots can use without seeing)
// ---------------------------------------------------------------------------

export async function listVault(userId: string): Promise<VaultEntry[]> {
  return (await kv().get<VaultEntry[]>(`vault:${userId}`)) ?? [];
}

export async function saveVaultEntry(userId: string, entry: Omit<VaultEntry, "id" | "createdAt">): Promise<VaultEntry> {
  const full: VaultEntry = { ...entry, id: newId("vlt", 10), createdAt: nowIso() };
  await kv().update<VaultEntry[]>(`vault:${userId}`, (items) => [...(items ?? []).filter((e) => e.site !== entry.site || e.username !== entry.username), full]);
  return full;
}

export async function deleteVaultEntry(userId: string, id: string): Promise<void> {
  await kv().update<VaultEntry[]>(`vault:${userId}`, (items) => (items ?? []).filter((e) => e.id !== id));
}

// ---------------------------------------------------------------------------
// Computer state (what the UI shows about the shared machine)
// ---------------------------------------------------------------------------

export async function getComputer(userId: string): Promise<ComputerState | null> {
  return kv().get<ComputerState>(`computer:${userId}`);
}

export async function updateComputer(userId: string, fn: (state: ComputerState) => ComputerState): Promise<void> {
  await kv().update<ComputerState>(`computer:${userId}`, (state) =>
    fn(
      state ?? {
        userId,
        sandboxKind: "unknown",
        updatedAt: nowIso(),
        files: [],
        snapshotBytes: 0,
        activity: [],
      },
    ),
  );
}

export async function logComputerActivity(userId: string, activity: Omit<ComputerActivity, "id" | "at">): Promise<void> {
  await updateComputer(userId, (state) => ({
    ...state,
    updatedAt: nowIso(),
    activity: [{ ...activity, id: newId("act", 10), at: nowIso() }, ...state.activity].slice(0, 200),
  }));
}

// ---------------------------------------------------------------------------
// Teach-a-task recordings
// ---------------------------------------------------------------------------

export async function saveRecording(recording: Omit<TeachRecording, "id" | "createdAt">): Promise<TeachRecording> {
  const full: TeachRecording = { ...recording, id: newId("rec", 10), createdAt: nowIso() };
  await pushCapped(`recordings:${recording.userId}`, full, 50);
  return full;
}

export async function listRecordings(userId: string): Promise<TeachRecording[]> {
  return (await kv().get<TeachRecording[]>(`recordings:${userId}`)) ?? [];
}
