import { createHash } from "node:crypto";
import type { SandboxSession } from "eve/sandbox";
import { blobs } from "../../lib/store/blobs";
import { kv } from "../../lib/store/kv";
import { updateComputer } from "../../lib/store/repo";
import { nowIso } from "../../lib/ids";

/**
 * Every bot a user owns shares one computer. Each eve session still gets its
 * own sandbox (that is what keeps runs durable and isolated per session),
 * but `/workspace/shared` is the user's persistent drive: it is restored when
 * a sandbox opens and synced back after every turn, so files, downloads, and
 * the saved browser profile follow the user from bot to bot.
 */
export const SHARED_DIR = "/workspace/shared";
const MAX_FILES = 400;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const SKIP = [/\/node_modules\//, /\/\.cache\//, /\/\.git\//, /\.lock$/, /parent\.lock$/, /\.sqlite-wal$/, /\.sqlite-shm$/];

interface Manifest {
  files: Record<string, { size: number; hash: string }>;
  updatedAt: string;
}

function manifestKey(userId: string) {
  return `computer-manifest:${userId}`;
}

function blobPath(userId: string, relative: string) {
  return `computers/${userId}/${relative}`;
}

async function listFiles(sandbox: SandboxSession): Promise<string[]> {
  const result = await sandbox.run({
    command: `mkdir -p ${SHARED_DIR} && cd ${SHARED_DIR} && find . -type f 2>/dev/null | head -n ${MAX_FILES * 2}`,
  });
  if (result.exitCode !== 0) return [];
  return result.stdout
    .split("\n")
    .map((line) => line.trim().replace(/^\.\//, ""))
    .filter((line) => line.length > 0 && !SKIP.some((re) => re.test(`/${line}`)));
}

/**
 * What this sandbox's drive looked like when it was restored (and after each
 * sync). Changes are measured against it, never against the shared manifest,
 * which other Bots may have moved on since.
 */
const BASELINE_PATH = "/workspace/.bezbot/drive-baseline.json";

async function readBaseline(sandbox: SandboxSession): Promise<Manifest["files"] | null> {
  try {
    const raw = await sandbox.readTextFile({ path: BASELINE_PATH });
    return raw ? (JSON.parse(raw) as Manifest["files"]) : null;
  } catch {
    return null;
  }
}

async function writeBaseline(sandbox: SandboxSession, files: Manifest["files"]): Promise<void> {
  await sandbox.run({ command: "mkdir -p /workspace/.bezbot" });
  await sandbox.writeTextFile({ path: BASELINE_PATH, content: JSON.stringify(files) });
}

/** Copies the user's drive into a freshly opened sandbox. */
export async function restoreSharedDrive(sandbox: SandboxSession, userId: string): Promise<number> {
  const manifest = await kv().get<Manifest>(manifestKey(userId));
  await sandbox.run({ command: `mkdir -p ${SHARED_DIR}` });
  if (!manifest) {
    await sandbox.writeTextFile({
      path: `${SHARED_DIR}/README.md`,
      content:
        "# Shared drive\n\nEverything in this folder is shared by all of your Bots and survives across tasks.\nBots save deliverables, downloads, and notes here.\n",
    });
    await writeBaseline(sandbox, {});
    return 0;
  }
  const baseline: Manifest["files"] = {};
  for (const [relative, entry] of Object.entries(manifest.files)) {
    const data = await blobs().get(blobPath(userId, relative));
    if (!data) continue;
    await sandbox.writeBinaryFile({ path: `${SHARED_DIR}/${relative}`, content: data });
    baseline[relative] = entry;
  }
  await writeBaseline(sandbox, baseline);
  return Object.keys(baseline).length;
}

/**
 * Uploads what this sandbox changed in `/workspace/shared` since it was
 * restored, and records a listing for the UI. Files this sandbox never saw
 * (added or updated by a Bot running at the same time) are left alone.
 */
export async function syncSharedDrive(sandbox: SandboxSession, userId: string, sandboxKind: string): Promise<void> {
  const files = await listFiles(sandbox);
  const baseline = await readBaseline(sandbox);
  const latest = (await kv().get<Manifest>(manifestKey(userId))) ?? { files: {}, updatedAt: nowIso() };
  // Without a baseline (a sandbox restored before baselines existed), fall back
  // to the shared manifest for uploads and never delete anything.
  const reference = baseline ?? latest.files;
  const current: Manifest["files"] = {};
  const changed: Manifest["files"] = {};
  let total = 0;

  for (const relative of files.slice(0, MAX_FILES)) {
    let data: Uint8Array | null;
    try {
      data = await sandbox.readBinaryFile({ path: `${SHARED_DIR}/${relative}` });
    } catch {
      continue;
    }
    if (!data) continue;
    if (data.byteLength > MAX_FILE_BYTES || total + data.byteLength > MAX_TOTAL_BYTES) continue;
    total += data.byteLength;
    const entry = { size: data.byteLength, hash: createHash("sha1").update(data).digest("hex") };
    current[relative] = entry;
    if (reference[relative]?.hash !== entry.hash) {
      await blobs().put(blobPath(userId, relative), data);
      changed[relative] = entry;
    }
  }

  // Deleted here: present in this sandbox's baseline, gone now.
  const deletedHere = baseline ? Object.keys(baseline).filter((p) => !(p in current)) : [];
  let removed: string[] = [];
  const merged = await kv().update<Manifest>(manifestKey(userId), (manifest) => {
    const files = { ...(manifest?.files ?? {}) };
    // Only drop a file if nobody else changed it since this sandbox saw it.
    removed = deletedHere.filter((p) => files[p] && files[p]!.hash === baseline?.[p]?.hash);
    for (const p of removed) delete files[p];
    Object.assign(files, changed);
    return { files, updatedAt: nowIso() };
  });
  if (removed.length > 0) await blobs().del(removed.map((p) => blobPath(userId, p)));
  await writeBaseline(sandbox, current);
  if (!merged) return;

  await updateComputer(userId, (state) => ({
    ...state,
    sandboxKind,
    updatedAt: nowIso(),
    files: Object.entries(merged.files)
      .map(([p, f]) => ({ path: p, size: f.size }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    snapshotBytes: Object.values(merged.files).reduce((sum, f) => sum + f.size, 0),
  }));
}

export async function readSharedFile(userId: string, relative: string): Promise<Uint8Array | null> {
  const manifest = await kv().get<Manifest>(manifestKey(userId));
  if (!manifest?.files[relative]) return null;
  return blobs().get(blobPath(userId, relative));
}

/** Saves the desktop's latest screenshot so the app can show what the bot sees. */
export async function captureScreenshot(sandbox: SandboxSession, userId: string): Promise<boolean> {
  const path = sandbox.resolvePath("computer-use/latest.png");
  try {
    const data = await sandbox.readBinaryFile({ path });
    if (!data || data.byteLength === 0) return false;
    await blobs().put(`screens/${userId}/latest.png`, data, "image/png");
    await updateComputer(userId, (state) => ({ ...state, lastScreenshotAt: nowIso(), updatedAt: nowIso() }));
    return true;
  } catch {
    return false;
  }
}

/** Marks a sandbox as having a managed desktop (Vercel Sandbox + computer use). */
export async function hasDesktop(sandbox: SandboxSession): Promise<boolean> {
  const result = await sandbox.run({ command: "test -f /workspace/.bezbot/desktop && echo yes || echo no" });
  return result.stdout.trim() === "yes";
}
