export type AutoReviewMode = "auto" | "always" | "off";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  plan: "free" | "pro" | "pro_plus" | "ultra" | "teams";
  timezone?: string;
}

export type BotStatus = "idle" | "working" | "waiting" | "error";

export interface Bot {
  id: string;
  userId: string;
  name: string;
  /** One line, e.g. "Generate pipeline overnight." */
  job: string;
  /** What the bot does, shown on its profile. */
  description: string;
  /** Operator-authored instructions appended to the persona. */
  instructions: string;
  emoji: string;
  color: string;
  templateId?: string;
  autoReview: AutoReviewMode;
  /** Other bots this bot may message autonomously. Empty means "any of my bots". */
  allowedPeers: string[];
  /** Whether this bot may start conversations with other bots on its own. */
  autonomous: boolean;
  status: BotStatus;
  statusText?: string;
  lastActiveAt?: string;
  shareId?: string;
  createdAt: string;
  updatedAt: string;
}

/** A 1:1 conversation with one bot. Backed by one durable eve session. */
export interface Conversation {
  id: string;
  userId: string;
  botId: string;
  title: string;
  sessionId?: string;
  mode: "dm" | "teach" | "routine" | "botnet";
  createdAt: string;
  updatedAt: string;
}

/** A group thread: several bots plus the user. The lead bot owns the eve session. */
export interface Thread {
  id: string;
  userId: string;
  title: string;
  memberBotIds: string[];
  leadBotId: string;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineSchedule {
  /** Repeat interval in minutes; null for a one-off run. */
  everyMinutes: number | null;
  /** Optional daily clock time (HH:MM, 24h) in the user's timezone. */
  at?: string | null;
  /** Weekdays (0=Sun..6=Sat) the daily time applies to. */
  days?: number[] | null;
  timezone: string;
}

export interface Routine {
  id: string;
  userId: string;
  botId: string;
  name: string;
  description: string;
  /** Step-by-step procedure the bot follows (markdown). */
  steps: string;
  source: "taught" | "manual" | "template" | "bot";
  schedule: RoutineSchedule | null;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt?: string | null;
  lastStatus?: "running" | "succeeded" | "failed" | "queued" | null;
  lastSessionId?: string | null;
  runCount: number;
  leaseUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryEntry {
  id: string;
  text: string;
  source: "bot" | "user" | "teammate";
  /** Bot that wrote the memory (for team memory). */
  authorBotId?: string;
  createdAt: string;
}

export interface MemoryDoc {
  entries: MemoryEntry[];
  version: number;
  updatedAt: string;
}

export type InboxKind = "approval" | "question" | "done" | "memory" | "botnet" | "routine" | "error";

export interface InboxItem {
  id: string;
  userId: string;
  botId?: string;
  kind: InboxKind;
  title: string;
  body?: string;
  href?: string;
  sessionId?: string;
  read: boolean;
  createdAt: string;
}

/** One autonomous message between two bots. */
export interface BotnetMessage {
  id: string;
  userId: string;
  exchangeId: string;
  fromBotId: string;
  toBotId: string;
  kind: "request" | "reply" | "error";
  text: string;
  /** Session that sent the request (the reply wakes it). */
  originSessionId?: string;
  /** Child session doing the work for the recipient. */
  childSessionId?: string;
  agentId?: string;
  depth: number;
  createdAt: string;
}

export interface BotnetExchange {
  id: string;
  userId: string;
  fromBotId: string;
  toBotId: string;
  subject: string;
  status: "working" | "replied" | "failed";
  originSessionId?: string;
  threadId?: string;
  /** eve's handle for the teammate child session, used to continue the conversation. */
  agentId?: string;
  /** Durable session id of the teammate doing the work (streamable). */
  childSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Who a durable eve session belongs to. Written by hooks when a session
 * starts so tools, sandbox selectors, and route auth can find it.
 */
export interface SessionContextRecord {
  sessionId: string;
  userId: string;
  botId: string;
  mode: "dm" | "thread" | "teach" | "routine" | "teammate";
  threadId?: string;
  conversationId?: string;
  routineId?: string;
  exchangeId?: string;
  /** Bot that delegated to this teammate session. */
  fromBotId?: string;
  rootSessionId?: string;
  depth: number;
  createdAt: string;
}

export interface VaultEntry {
  id: string;
  label: string;
  site: string;
  username: string;
  /** AES-GCM ciphertext, never sent to the model. */
  secret: string;
  notes?: string;
  createdAt: string;
}

export interface ComputerFileEntry {
  path: string;
  size: number;
}

export interface ComputerState {
  userId: string;
  sandboxKind: string;
  updatedAt: string;
  files: ComputerFileEntry[];
  snapshotBytes: number;
  lastScreenshotUrl?: string | null;
  lastScreenshotAt?: string | null;
  activity: ComputerActivity[];
}

export interface ComputerActivity {
  id: string;
  botId?: string;
  kind: "command" | "file" | "browser" | "screen" | "credential";
  summary: string;
  detail?: string;
  at: string;
}

export interface TeachRecording {
  id: string;
  userId: string;
  botId: string;
  title: string;
  notes: string;
  frames: number;
  durationMs: number;
  conversationId?: string;
  createdAt: string;
}
