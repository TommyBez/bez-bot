import { newId, nowIso } from "../ids";
import { computeNextRun } from "../schedule";
import { getTemplate } from "../templates";
import { kv } from "./kv";
import type {
  AutoReviewRule,
  AutoReviewSettings,
  Bot,
  ComputerActivity,
  ComputerState,
  Exchange,
  ExchangeMessage,
  Group,
  GroupMessage,
  MemoryDoc,
  MemoryEntry,
  Routine,
  RoutineRun,
  RoutineSchedule,
  SessionRecord,
  Skill,
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

/**
 * Returns true the first time `key` is claimed; later claims return false.
 *
 * `kv().update` may run its callback more than once (Redis retries after a
 * failed compare-and-set), so every callback below resets whatever it
 * reports before deciding; only the attempt that was written counts.
 */
export async function claimOnce(key: string): Promise<boolean> {
  let won = false;
  await kv().update<string>(`once:${key}`, (existing) => {
    won = false;
    if (existing) return existing;
    won = true;
    return nowIso();
  });
  return won;
}

export function preview(text: string, max = 120): string {
  const flat = text.replace(/<bezbot-[^>]*\/>/g, "").replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const DEFAULT_AUTO_REVIEW: AutoReviewSettings = { enabled: true, rules: [] };

function withDefaults(user: User): User {
  return { ...user, autoReview: user.autoReview ?? DEFAULT_AUTO_REVIEW };
}

export async function getUser(id: string): Promise<User | null> {
  const user = await kv().get<User>(`user:${id}`);
  return user ? withDefaults(user) : null;
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
    autoReview: DEFAULT_AUTO_REVIEW,
  };
  await kv().set(`user:${user.id}`, user);
  await kv().set(`user-email:${email}`, user.id);
  return user;
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<User, "name" | "timezone" | "plan" | "onboardedAt" | "autoReview">>,
): Promise<User | null> {
  const user = await kv().update<User>(`user:${id}`, (u) => (u ? { ...withDefaults(u), ...patch } : null));
  return user ? withDefaults(user) : null;
}

export async function addAutoReviewRule(userId: string, rule: Omit<AutoReviewRule, "id" | "createdAt">): Promise<AutoReviewRule | null> {
  let saved: AutoReviewRule | null = null;
  await kv().update<User>(`user:${userId}`, (u) => {
    saved = null;
    if (!u) return null;
    const current = withDefaults(u);
    const duplicate = current.autoReview.rules.find(
      (r) => r.kind === rule.kind && r.tool === rule.tool && r.match.toLowerCase() === rule.match.toLowerCase(),
    );
    if (duplicate) {
      saved = duplicate;
      return current;
    }
    saved = { ...rule, id: newId("rule", 10), createdAt: nowIso() };
    return { ...current, autoReview: { ...current.autoReview, rules: [...current.autoReview.rules, saved] } };
  });
  return saved;
}

export async function removeAutoReviewRule(userId: string, ruleId: string): Promise<void> {
  await kv().update<User>(`user:${userId}`, (u) => {
    if (!u) return null;
    const current = withDefaults(u);
    return { ...current, autoReview: { ...current.autoReview, rules: current.autoReview.rules.filter((r) => r.id !== ruleId) } };
  });
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
  name?: string;
  label?: string;
  description?: string;
  emoji?: string;
  color?: string;
  templateId?: string;
  createdByBotId?: string;
  installRoutines?: boolean;
}

export async function createBot(userId: string, input: CreateBotInput, timezone = "UTC"): Promise<Bot> {
  const template = getTemplate(input.templateId);
  const existing = await listBots(userId);
  const now = nowIso();
  const templateDescription = template
    ? [template.description, template.instructions].filter(Boolean).join("\n\n")
    : "";
  const bot: Bot = {
    id: newId("bot"),
    userId,
    name: input.name?.trim() || template?.name || "New Bot",
    label: input.label?.trim() ?? template?.job ?? "",
    description: input.description?.trim() || templateDescription,
    emoji: input.emoji || template?.emoji || "🤖",
    color: input.color || template?.color || BOT_COLORS[existing.length % BOT_COLORS.length]!,
    templateId: template?.id,
    pinned: false,
    hidden: false,
    notifications: true,
    status: "idle",
    unread: false,
    createdByBotId: input.createdByBotId,
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
        instruction: r.steps,
        source: "template",
        schedule: r.schedule ? { ...r.schedule, timezone } : null,
        // Template routines start paused so nothing runs before the user opts in.
        enabled: false,
      });
    }
  }
  return bot;
}

export type BotPatch = Partial<
  Pick<Bot, "name" | "label" | "description" | "emoji" | "color" | "pinned" | "hidden" | "notifications" | "unread" | "shareId">
>;

export async function updateBot(userId: string, botId: string, patch: BotPatch): Promise<Bot | null> {
  const updated = await kv().update<Bot>(`bot:${botId}`, (bot) =>
    bot && bot.userId === userId ? { ...bot, ...patch, updatedAt: nowIso() } : bot,
  );
  return updated && updated.userId === userId ? updated : null;
}

/** Stores the Bot's conversation once; later calls return the first session. */
export async function setBotSession(botId: string, sessionId: string): Promise<string | null> {
  const bot = await kv().update<Bot>(`bot:${botId}`, (b) => (b ? (b.sessionId ? b : { ...b, sessionId }) : null));
  return bot?.sessionId ?? null;
}

export async function setBotStatus(botId: string, status: Bot["status"], statusText?: string): Promise<void> {
  await kv().update<Bot>(`bot:${botId}`, (bot) => (bot ? { ...bot, status, statusText } : null));
}

/** Records new activity in a Bot's chat for the sidebar preview and unread dot. */
export async function markBotActivity(botId: string, text: string, unread: boolean): Promise<void> {
  await kv().update<Bot>(`bot:${botId}`, (bot) =>
    bot ? { ...bot, lastMessageAt: nowIso(), lastPreview: preview(text) || bot.lastPreview, unread: bot.unread || unread } : null,
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
  for (const group of await listGroups(userId)) {
    if (group.memberBotIds.includes(botId)) {
      await updateGroup(userId, group.id, { memberBotIds: group.memberBotIds.filter((id) => id !== botId) });
    }
  }
  return true;
}

/** Copies profile, settings, and routines. History, memory, and attachments stay behind. */
export async function duplicateBot(userId: string, botId: string, timezone = "UTC"): Promise<Bot | null> {
  const source = await getOwnedBot(userId, botId);
  if (!source) return null;
  const copy = await createBot(
    userId,
    {
      name: `${source.name} copy`,
      label: source.label,
      description: source.description,
      emoji: source.emoji,
      color: source.color,
      installRoutines: false,
    },
    timezone,
  );
  await updateBot(userId, copy.id, { notifications: source.notifications });
  for (const r of await listRoutines(userId, botId)) {
    await createRoutine(userId, {
      botId: copy.id,
      name: r.name,
      instruction: r.instruction,
      source: r.source,
      schedule: r.schedule,
      enabled: false,
    });
  }
  return (await getBot(copy.id)) ?? copy;
}

// ---------------------------------------------------------------------------
// Templates: share a Bot as a link others can add.
// ---------------------------------------------------------------------------

export interface SharedBot {
  shareId: string;
  name: string;
  label: string;
  description: string;
  emoji: string;
  color: string;
  templateId?: string;
  authorName: string;
  visibility: "public";
  routines: { name: string; instruction: string; schedule: Routine["schedule"] }[];
  skills: { slug: string; name: string; description: string; body: string }[];
  createdAt: string;
  adds: number;
}

export async function shareBot(userId: string, botId: string): Promise<SharedBot | null> {
  const bot = await getOwnedBot(userId, botId);
  const user = await getUser(userId);
  if (!bot || !user) return null;
  const shareId = bot.shareId ?? newId("b", 18).slice(2);
  const routines = await listRoutines(userId, botId);
  const skills = (await listSkills(userId)).filter((s) => !s.draft && s.createdByBotId === botId);
  const shared: SharedBot = {
    shareId,
    name: bot.name,
    label: bot.label,
    description: bot.description,
    emoji: bot.emoji,
    color: bot.color,
    templateId: bot.templateId,
    authorName: user.name,
    visibility: "public",
    routines: routines.map((r) => ({ name: r.name, instruction: r.instruction, schedule: r.schedule })),
    skills: skills.map((s) => ({ slug: s.slug, name: s.name, description: s.description, body: s.body })),
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
      label: shared.label,
      description: shared.description,
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
      instruction: r.instruction,
      source: "template",
      schedule: r.schedule ? { ...r.schedule, timezone } : null,
      enabled: false,
    });
  }
  for (const s of shared.skills ?? []) {
    await saveSkill(userId, { slug: s.slug, name: s.name, description: s.description, body: s.body, source: "template", draft: false });
  }
  await kv().update<SharedBot>(`share:${shareId}`, (s) => (s ? { ...s, adds: s.adds + 1 } : null));
  return bot;
}

// ---------------------------------------------------------------------------
// Group chats: two to six Bots and you.
// ---------------------------------------------------------------------------

export const GROUP_MIN = 2;
export const GROUP_MAX = 6;

export async function listGroups(userId: string): Promise<Group[]> {
  const ids = (await kv().get<string[]>(`idx:${userId}:groups`)) ?? [];
  const groups = await loadMany<Group>("group", ids);
  return groups.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getGroup(id: string): Promise<Group | null> {
  return kv().get<Group>(`group:${id}`);
}

export async function getOwnedGroup(userId: string, id: string): Promise<Group | null> {
  const group = await getGroup(id);
  return group && group.userId === userId ? group : null;
}

export async function createGroup(userId: string, input: { memberBotIds: string[]; name?: string; description?: string }): Promise<Group> {
  const bots = await listBots(userId);
  const members = [...new Set(input.memberBotIds)].filter((id) => bots.some((b) => b.id === id));
  if (members.length < GROUP_MIN || members.length > GROUP_MAX) {
    throw new Error(`A group chat needs ${GROUP_MIN} to ${GROUP_MAX} of your Bots.`);
  }
  const names = members.map((id) => bots.find((b) => b.id === id)!.name);
  const now = nowIso();
  const group: Group = {
    id: newId("grp"),
    userId,
    name: input.name?.trim() || generatedGroupName(names),
    description: input.description?.trim() ?? "",
    memberBotIds: members,
    sessions: {},
    working: [],
    pinned: false,
    hidden: false,
    unread: false,
    createdAt: now,
    updatedAt: now,
  };
  await kv().set(`group:${group.id}`, group);
  await addToIndex(`idx:${userId}:groups`, group.id, false);
  return group;
}

function generatedGroupName(names: string[]): string {
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} & ${names.length - 2} more`;
}

export async function updateGroup(
  userId: string,
  id: string,
  patch: Partial<Pick<Group, "name" | "description" | "memberBotIds" | "pinned" | "hidden" | "unread">>,
): Promise<Group | null> {
  const updated = await kv().update<Group>(`group:${id}`, (g) =>
    g && g.userId === userId ? { ...g, ...patch, updatedAt: nowIso() } : g,
  );
  return updated && updated.userId === userId ? updated : null;
}

export async function setGroupSession(groupId: string, botId: string, sessionId: string): Promise<string | null> {
  const group = await kv().update<Group>(`group:${groupId}`, (g) =>
    g ? (g.sessions[botId] ? g : { ...g, sessions: { ...g.sessions, [botId]: sessionId } }) : null,
  );
  return group?.sessions[botId] ?? null;
}

export async function setGroupWorking(groupId: string, botId: string, working: boolean): Promise<void> {
  await kv().update<Group>(`group:${groupId}`, (g) => {
    if (!g) return null;
    const rest = g.working.filter((id) => id !== botId);
    return { ...g, working: working ? [...rest, botId] : rest };
  });
}

export async function deleteGroup(userId: string, id: string): Promise<void> {
  const group = await getOwnedGroup(userId, id);
  if (!group) return;
  await kv().del(`group:${id}`);
  await kv().del(`group-msgs:${id}`);
  await removeFromIndex(`idx:${userId}:groups`, id);
}

export async function listGroupMessages(groupId: string): Promise<GroupMessage[]> {
  return (await kv().get<GroupMessage[]>(`group-msgs:${groupId}`)) ?? [];
}

export async function appendGroupMessage(
  message: Omit<GroupMessage, "id" | "createdAt">,
  options: { unread?: boolean } = {},
): Promise<GroupMessage> {
  const full: GroupMessage = { ...message, id: newId("gm", 12), createdAt: nowIso() };
  await kv().update<GroupMessage[]>(`group-msgs:${message.groupId}`, (items) => [...(items ?? []), full].slice(-500));
  await kv().update<Group>(`group:${message.groupId}`, (g) =>
    g
      ? { ...g, lastMessageAt: full.createdAt, lastPreview: preview(full.text), unread: g.unread || Boolean(options.unread) }
      : null,
  );
  return full;
}

/** Tracks the last group message each member has been shown. */
export async function takeUnseenGroupMessages(groupId: string, botId: string): Promise<GroupMessage[]> {
  const messages = await listGroupMessages(groupId);
  let lastSeen: string | null = null;
  await kv().update<Record<string, string>>(`group-seen:${groupId}`, (seen) => {
    lastSeen = seen?.[botId] ?? null;
    const latest = messages.at(-1)?.id;
    return latest ? { ...(seen ?? {}), [botId]: latest } : (seen ?? {});
  });
  const start = lastSeen ? messages.findIndex((m) => m.id === lastSeen) + 1 : Math.max(0, messages.length - 20);
  return messages.slice(start).filter((m) => m.author !== botId);
}

// ---------------------------------------------------------------------------
// Routines: each belongs to one Bot and posts its result in that Bot's chat.
// ---------------------------------------------------------------------------

export const MAX_ROUTINES_PER_BOT = 50;
const MAX_ROUTINE_RUNS = 20;

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
  instruction: string;
  source?: Routine["source"];
  schedule?: RoutineSchedule | null;
  enabled?: boolean;
}

export async function createRoutine(userId: string, input: RoutineInput): Promise<Routine> {
  const bot = await getOwnedBot(userId, input.botId);
  if (!bot) throw new Error("Unknown bot.");
  if ((await listRoutines(userId, input.botId)).length >= MAX_ROUTINES_PER_BOT) {
    throw new Error(`A Bot can own up to ${MAX_ROUTINES_PER_BOT} routines.`);
  }
  const now = nowIso();
  const schedule = input.schedule ?? null;
  const enabled = input.enabled ?? true;
  const routine: Routine = {
    id: newId("rtn"),
    userId,
    botId: input.botId,
    name: input.name.trim(),
    instruction: input.instruction.trim(),
    source: input.source ?? "chat",
    schedule,
    enabled,
    nextRunAt: enabled ? (computeNextRun(schedule)?.toISOString() ?? null) : null,
    runs: [],
    webhookKey: newId("whk", 32).slice(4),
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
  patch: Partial<Pick<Routine, "name" | "instruction" | "schedule" | "enabled">>,
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
      won = false;
      if (!r || !r.enabled || !r.nextRunAt) return r;
      if (new Date(r.nextRunAt).getTime() > now.getTime()) return r;
      if (r.leaseUntil && new Date(r.leaseUntil).getTime() > now.getTime()) return r;
      won = true;
      return { ...r, leaseUntil: new Date(now.getTime() + leaseMs).toISOString() };
    });
    if (won && routine) claimed.push(routine);
  }
  return claimed;
}

/** Records a new run and, for scheduled runs, moves `nextRunAt` forward. */
export async function startRoutineRun(id: string, trigger: RoutineRun["trigger"]): Promise<RoutineRun | null> {
  const run: RoutineRun = { id: newId("run", 10), trigger, status: "running", startedAt: nowIso() };
  const updated = await kv().update<Routine>(`routine:${id}`, (r) => {
    if (!r) return null;
    const next = trigger === "schedule" ? computeNextRun(r.schedule, new Date()) : null;
    return {
      ...r,
      lastRunAt: run.startedAt,
      runs: [run, ...(r.runs ?? [])].slice(0, MAX_ROUTINE_RUNS),
      leaseUntil: trigger === "schedule" ? null : r.leaseUntil,
      nextRunAt: trigger === "schedule" ? (r.enabled && next ? next.toISOString() : null) : r.nextRunAt,
    };
  });
  if (!updated) return null;
  await syncDueIndex(updated);
  return run;
}

export async function finishRoutineRun(id: string, runId: string, status: "succeeded" | "failed" | "cancelled"): Promise<void> {
  await kv().update<Routine>(`routine:${id}`, (r) =>
    r
      ? {
          ...r,
          runs: (r.runs ?? []).map((run) =>
            run.id === runId && run.status === "running" ? { ...run, status, finishedAt: nowIso() } : run,
          ),
        }
      : null,
  );
}

export async function releaseRoutine(id: string, retryAt: Date): Promise<void> {
  const updated = await kv().update<Routine>(`routine:${id}`, (r) =>
    r ? { ...r, leaseUntil: null, nextRunAt: retryAt.toISOString() } : null,
  );
  if (updated) await syncDueIndex(updated);
}

// ---------------------------------------------------------------------------
// Skills: one private library shared by all of a user's Bots.
// ---------------------------------------------------------------------------

export function skillSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "skill"
  );
}

export async function listSkills(userId: string): Promise<Skill[]> {
  const ids = (await kv().get<string[]>(`idx:${userId}:skills`)) ?? [];
  const skills = await loadMany<Skill>("skill", ids);
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSkill(userId: string, ref: string): Promise<Skill | null> {
  const needle = ref.trim().replace(/^\//, "");
  const skills = await listSkills(userId);
  return (
    skills.find((s) => s.id === needle) ??
    skills.find((s) => s.slug === skillSlug(needle)) ??
    skills.find((s) => s.name.toLowerCase() === needle.toLowerCase()) ??
    null
  );
}

/** Creates a skill, or replaces the one with the same slug. */
export async function saveSkill(
  userId: string,
  input: { slug?: string; name: string; description: string; body: string; source: Skill["source"]; draft: boolean; createdByBotId?: string },
): Promise<Skill> {
  const slug = skillSlug(input.slug || input.name);
  const existing = (await listSkills(userId)).find((s) => s.slug === slug);
  const now = nowIso();
  const skill: Skill = {
    id: existing?.id ?? newId("skl"),
    userId,
    slug,
    name: input.name.trim(),
    description: input.description.trim(),
    body: input.body.trim(),
    source: input.source,
    draft: input.draft,
    createdByBotId: existing?.createdByBotId ?? input.createdByBotId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await kv().set(`skill:${skill.id}`, skill);
  await addToIndex(`idx:${userId}:skills`, skill.id, false);
  return skill;
}

export async function updateSkill(
  userId: string,
  id: string,
  patch: Partial<Pick<Skill, "name" | "description" | "body" | "draft">>,
): Promise<Skill | null> {
  const updated = await kv().update<Skill>(`skill:${id}`, (s) => (s && s.userId === userId ? { ...s, ...patch, updatedAt: nowIso() } : s));
  return updated && updated.userId === userId ? updated : null;
}

export async function deleteSkill(userId: string, id: string): Promise<void> {
  const skill = await kv().get<Skill>(`skill:${id}`);
  if (!skill || skill.userId !== userId) return;
  await kv().del(`skill:${id}`);
  await removeFromIndex(`idx:${userId}:skills`, id);
}

// ---------------------------------------------------------------------------
// Memory: one document per Bot.
// ---------------------------------------------------------------------------

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
  input: { text: string; source: MemoryEntry["source"] },
): Promise<MemoryEntry | null> {
  const text = input.text.replace(/\s+/g, " ").trim().slice(0, 1200);
  if (!text) return null;
  let saved: MemoryEntry | null = null;
  await kv().update<MemoryDoc>(memoryKey(userId, botId), (doc) => {
    saved = null;
    const current = doc ?? { entries: [], version: 0, updatedAt: nowIso() };
    const duplicate = current.entries.find((e) => e.text.toLowerCase() === text.toLowerCase());
    if (duplicate) {
      saved = duplicate;
      return current;
    }
    saved = { id: newId("mem", 10), text, source: input.source, createdAt: nowIso() };
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
    removed = false;
    if (!doc) return null;
    const entries = doc.entries.filter((e) => e.id !== entryId);
    removed = entries.length !== doc.entries.length;
    return { entries, version: doc.version + (removed ? 1 : 0), updatedAt: nowIso() };
  });
  return removed;
}

// ---------------------------------------------------------------------------
// Bot-to-bot conversations
// ---------------------------------------------------------------------------

export const MAX_EXCHANGE_HOPS = 8;

export async function createExchange(input: Pick<Exchange, "userId" | "fromBotId" | "toBotId" | "subject">): Promise<Exchange> {
  const now = nowIso();
  const exchange: Exchange = { ...input, id: newId("xch"), status: "open", hops: 0, createdAt: now, updatedAt: now };
  await kv().set(`xch:${exchange.id}`, exchange);
  await addToIndex(`idx:${input.userId}:exchanges`, exchange.id);
  await kv().update<string[]>(`idx:${input.userId}:exchanges`, (ids) => (ids ?? []).slice(0, 300));
  return exchange;
}

export async function getExchange(id: string): Promise<Exchange | null> {
  return kv().get<Exchange>(`xch:${id}`);
}

export async function updateExchange(id: string, patch: Partial<Pick<Exchange, "status" | "hops">>): Promise<Exchange | null> {
  return kv().update<Exchange>(`xch:${id}`, (x) => (x ? { ...x, ...patch, updatedAt: nowIso() } : null));
}

export async function appendExchangeMessage(message: Omit<ExchangeMessage, "id" | "createdAt">): Promise<ExchangeMessage> {
  const full: ExchangeMessage = { ...message, id: newId("xm", 10), createdAt: nowIso() };
  await kv().update<ExchangeMessage[]>(`xch-msgs:${message.exchangeId}`, (items) => [...(items ?? []), full].slice(-100));
  await kv().update<Exchange>(`xch:${message.exchangeId}`, (x) =>
    x ? { ...x, hops: x.hops + 1, status: message.kind === "reply" ? "replied" : "open", updatedAt: nowIso() } : null,
  );
  return full;
}

export async function listExchangeMessages(exchangeId: string): Promise<ExchangeMessage[]> {
  return (await kv().get<ExchangeMessage[]>(`xch-msgs:${exchangeId}`)) ?? [];
}

/** Per-user sliding window so autonomous chatter can't run away. */
export async function consumeBotnetBudget(userId: string, maxPerHour: number): Promise<boolean> {
  const hour = new Date().toISOString().slice(0, 13);
  let allowed = false;
  await kv().update<{ hour: string; count: number }>(`botnet-budget:${userId}`, (b) => {
    allowed = false;
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

export async function registerSession(record: Omit<SessionRecord, "createdAt">): Promise<SessionRecord> {
  const existing = await getSessionRecord(record.sessionId);
  if (existing) return existing;
  const full: SessionRecord = { ...record, createdAt: nowIso() };
  await kv().set(`sess:${record.sessionId}`, full);
  return full;
}

export async function getSessionRecord(sessionId: string): Promise<SessionRecord | null> {
  return kv().get<SessionRecord>(`sess:${sessionId}`);
}

// ---------------------------------------------------------------------------
// Vault (credentials the bots can use without seeing)
// ---------------------------------------------------------------------------

export async function listVault(userId: string): Promise<VaultEntry[]> {
  return (await kv().get<VaultEntry[]>(`vault:${userId}`)) ?? [];
}

export async function saveVaultEntry(userId: string, entry: Omit<VaultEntry, "id" | "createdAt">): Promise<VaultEntry> {
  const full: VaultEntry = { ...entry, id: newId("vlt", 10), createdAt: nowIso() };
  await kv().update<VaultEntry[]>(`vault:${userId}`, (items) => [
    ...(items ?? []).filter((e) => e.site !== entry.site || e.username !== entry.username),
    full,
  ]);
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
