export interface AutoReviewRule {
  id: string;
  /** "ask" always stops matching actions; "allow" lets them run without asking. Ask wins on conflict. */
  kind: "ask" | "allow";
  /** Tool the rule applies to, e.g. "bash" or "use_login". */
  tool: string;
  /** Case-insensitive substring of the action summary; empty matches every call of the tool. */
  match: string;
  description: string;
  createdAt: string;
}

export interface AutoReviewSettings {
  /** When on, a reviewer model checks risky actions and asks you only when needed. */
  enabled: boolean;
  rules: AutoReviewRule[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  plan: "free" | "pro" | "pro_plus" | "ultra" | "teams";
  /** IANA zone routines use; unset means auto-detect from the browser. */
  timezone?: string;
  onboardedAt?: string;
  autoReview: AutoReviewSettings;
}

/** Working: a turn is running. Attention: a question, approval, or handoff waits on you. */
export type BotStatus = "idle" | "working" | "attention" | "error";

export interface Bot {
  id: string;
  userId: string;
  name: string;
  /** Optional one-line title shown under the name, e.g. "Generate pipeline overnight." */
  label: string;
  /** The Bot's job and standing rules. The Bot reads it on every turn. */
  description: string;
  emoji: string;
  color: string;
  templateId?: string;
  /** The Bot's one persistent conversation (a durable eve session). */
  sessionId?: string;
  pinned: boolean;
  hidden: boolean;
  /** OS notification when the Bot finishes or needs input. */
  notifications: boolean;
  status: BotStatus;
  statusText?: string;
  /** New activity since the user last opened the chat. */
  unread: boolean;
  lastMessageAt?: string;
  lastPreview?: string;
  /** Set when another Bot created this one to help with its work. */
  createdByBotId?: string;
  shareId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Two to six Bots and you in one conversation. */
export interface Group {
  id: string;
  userId: string;
  name: string;
  /** Every Bot in the group reads this when it replies. */
  description: string;
  memberBotIds: string[];
  /** Each member's durable eve session for this group. */
  sessions: Record<string, string>;
  /** Members currently working on something in this group. */
  working: string[];
  pinned: boolean;
  hidden: boolean;
  unread: boolean;
  lastMessageAt?: string;
  lastPreview?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  /** "user" or a Bot id. */
  author: string;
  text: string;
  mentions: string[];
  createdAt: string;
}

export interface RoutineSchedule {
  /** Repeat interval in minutes; null when the routine runs at a clock time. */
  everyMinutes: number | null;
  /** Daily clock time (HH:MM, 24h) in the user's timezone. */
  at?: string | null;
  /** Weekdays (0=Sun..6=Sat) the daily time applies to. */
  days?: number[] | null;
  timezone: string;
}

export interface RoutineRun {
  id: string;
  trigger: "schedule" | "test" | "webhook";
  status: "running" | "succeeded" | "failed" | "cancelled";
  startedAt: string;
  finishedAt?: string;
}

export interface Routine {
  id: string;
  userId: string;
  botId: string;
  name: string;
  /** What the Bot does on each run (markdown). */
  instruction: string;
  source: "chat" | "template";
  schedule: RoutineSchedule | null;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt?: string | null;
  /** The 20 most recent runs, newest first. */
  runs: RoutineRun[];
  leaseUntil?: string | null;
  /** Bearer key for the routine's webhook trigger. */
  webhookKey: string;
  createdAt: string;
  updatedAt: string;
}

/** A reusable set of instructions, shared by every Bot the user has. */
export interface Skill {
  id: string;
  userId: string;
  /** Slug used in the composer: /weekly-report */
  slug: string;
  name: string;
  description: string;
  body: string;
  source: "taught" | "chat" | "template";
  draft: boolean;
  createdByBotId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryEntry {
  id: string;
  text: string;
  source: "bot" | "user";
  createdAt: string;
}

export interface MemoryDoc {
  entries: MemoryEntry[];
  version: number;
  updatedAt: string;
}

/** One conversation between two Bots: a request and the replies it gets. */
export interface Exchange {
  id: string;
  userId: string;
  fromBotId: string;
  toBotId: string;
  subject: string;
  status: "open" | "replied";
  /** Messages exchanged so far; capped to stop runaway loops. */
  hops: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeMessage {
  id: string;
  exchangeId: string;
  fromBotId: string;
  toBotId: string;
  kind: "request" | "reply";
  text: string;
  createdAt: string;
}

/**
 * Who a durable eve session belongs to: a Bot's own chat, or that Bot's seat
 * in a group. Written when the session is created.
 */
export interface SessionRecord {
  sessionId: string;
  userId: string;
  botId: string;
  kind: "bot" | "group";
  groupId?: string;
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
