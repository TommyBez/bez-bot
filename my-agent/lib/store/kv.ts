import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

/**
 * Minimal JSON key-value store shared by the Next.js app and the eve agent.
 *
 * - Local development writes JSON files under `.data/kv` at the project root,
 *   so `next dev` and `eve dev` (separate processes) see the same data.
 * - Deployments use Upstash Redis (`UPSTASH_REDIS_REST_URL` /
 *   `UPSTASH_REDIS_REST_TOKEN`, or the Vercel KV aliases `KV_REST_API_URL` /
 *   `KV_REST_API_TOKEN`).
 */
export interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  /** Read-modify-write. The updater receives `null` when the key is missing. */
  update<T>(key: string, fn: (current: T | null) => T | null): Promise<T | null>;
  /** Keys with a prefix. Intended for small admin/index scans only. */
  keys(prefix: string): Promise<string[]>;
}

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

/** Walks up from cwd to find the project root (the directory with `agent/` and `lib/`). */
export function findProjectRoot(): string {
  if (process.env.BEZBOT_DATA_DIR) return path.dirname(process.env.BEZBOT_DATA_DIR);
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(path.join(dir, "agent")) && existsSync(path.join(dir, "lib", "store"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

class FileKV implements KV {
  private readonly root: string;
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(root: string) {
    this.root = root;
  }

  private file(key: string): string {
    return path.join(this.root, `${encodeURIComponent(key)}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(this.file(key), "utf8");
      return JSON.parse(raw) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    const target = this.file(key);
    const tmp = `${target}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value));
    await fs.rename(tmp, target);
  }

  async del(key: string): Promise<void> {
    await fs.rm(this.file(key), { force: true });
  }

  async update<T>(key: string, fn: (current: T | null) => T | null): Promise<T | null> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    const next = previous.then(async () => {
      const current = await this.get<T>(key);
      const value = fn(current);
      if (value === null) await this.del(key);
      else await this.set(key, value);
      return value;
    });
    this.locks.set(
      key,
      next.catch(() => undefined),
    );
    return next;
  }

  async keys(prefix: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.root);
      return entries
        .filter((name) => name.endsWith(".json"))
        .map((name) => decodeURIComponent(name.slice(0, -5)))
        .filter((key) => key.startsWith(prefix));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}

class RedisKV implements KV {
  private clientPromise: Promise<import("@upstash/redis").Redis> | undefined;

  constructor(private readonly config: { url: string; token: string }) {}

  private client() {
    this.clientPromise ??= import("@upstash/redis").then(
      ({ Redis }) => new Redis({ url: this.config.url, token: this.config.token, automaticDeserialization: false }),
    );
    return this.clientPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await (await this.client()).get<string>(`bezbot:${key}`);
    return raw == null ? null : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await (await this.client()).set(`bezbot:${key}`, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await (await this.client()).del(`bezbot:${key}`);
  }

  async update<T>(key: string, fn: (current: T | null) => T | null): Promise<T | null> {
    // Upstash REST has no WATCH; a short retry on a version stamp keeps
    // concurrent writers from silently clobbering each other in common cases.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const redis = await this.client();
      const fullKey = `bezbot:${key}`;
      const raw = await redis.get<string>(fullKey);
      const current = raw == null ? null : (JSON.parse(raw) as T);
      const value = fn(current);
      if (value === null) {
        await redis.del(fullKey);
        return null;
      }
      const next = JSON.stringify(value);
      // Compare-and-set via Lua keeps the write atomic against the value we read.
      const script =
        "local v = redis.call('GET', KEYS[1]); if (v == ARGV[1]) or (v == false and ARGV[1] == '') then redis.call('SET', KEYS[1], ARGV[2]); return 1 else return 0 end";
      const ok = await redis.eval(script, [fullKey], [raw ?? "", next]);
      if (ok === 1) return value;
    }
    throw new Error(`Concurrent update conflict on ${key}`);
  }

  async keys(prefix: string): Promise<string[]> {
    const redis = await this.client();
    const found: string[] = [];
    let cursor = "0";
    do {
      const [nextCursor, batch] = await redis.scan(cursor, { match: `bezbot:${prefix}*`, count: 200 });
      cursor = String(nextCursor);
      found.push(...batch.map((k) => k.slice("bezbot:".length)));
    } while (cursor !== "0" && found.length < 5000);
    return found;
  }
}

let instance: KV | undefined;

export function kv(): KV {
  if (instance) return instance;
  const redis = redisConfig();
  if (redis) {
    instance = new RedisKV(redis);
  } else {
    if (process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "development") {
      console.warn(
        "[bezbot] No Upstash Redis configured; falling back to ephemeral /tmp storage. Add Upstash Redis from the Vercel Marketplace for durable data.",
      );
      instance = new FileKV("/tmp/bezbot-kv");
    } else {
      const dataDir = process.env.BEZBOT_DATA_DIR ?? path.join(findProjectRoot(), ".data");
      instance = new FileKV(path.join(dataDir, "kv"));
    }
  }
  return instance;
}

export function storageMode(): "redis" | "file" {
  return redisConfig() ? "redis" : "file";
}
