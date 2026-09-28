import { promises as fs } from "node:fs";
import path from "node:path";
import { findProjectRoot } from "./kv";

/**
 * Binary storage for computer files and screenshots.
 *
 * - `BLOB_READ_WRITE_TOKEN` set: private Vercel Blob.
 * - Otherwise: files under `.data/blobs` (local development).
 */
export interface Blobs {
  put(pathname: string, data: Uint8Array, contentType?: string): Promise<void>;
  get(pathname: string): Promise<Uint8Array | null>;
  del(pathnames: string[]): Promise<void>;
}

function safePath(pathname: string): string {
  const normalized = path.posix.normalize(pathname).replace(/^(\.\.(\/|$))+/, "").replace(/^\/+/, "");
  if (!normalized || normalized.startsWith("..")) throw new Error(`Invalid blob path: ${pathname}`);
  return normalized;
}

class FileBlobs implements Blobs {
  constructor(private readonly root: string) {}

  async put(pathname: string, data: Uint8Array): Promise<void> {
    const target = path.join(this.root, safePath(pathname));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
  }

  async get(pathname: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await fs.readFile(path.join(this.root, safePath(pathname))));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async del(pathnames: string[]): Promise<void> {
    await Promise.all(pathnames.map((p) => fs.rm(path.join(this.root, safePath(p)), { force: true })));
  }
}

class VercelBlobs implements Blobs {
  private readonly prefix = "bezbot";

  async put(pathname: string, data: Uint8Array, contentType?: string): Promise<void> {
    const { put } = await import("@vercel/blob");
    await put(`${this.prefix}/${safePath(pathname)}`, Buffer.from(data), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
    });
  }

  async get(pathname: string): Promise<Uint8Array | null> {
    const { get } = await import("@vercel/blob");
    const result = await get(`${this.prefix}/${safePath(pathname)}`, { access: "private", useCache: false });
    if (!result || !("stream" in result) || !result.stream) return null;
    const chunks: Uint8Array[] = [];
    const reader = (result.stream as ReadableStream<Uint8Array>).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return new Uint8Array(Buffer.concat(chunks.map((c) => Buffer.from(c))));
  }

  async del(pathnames: string[]): Promise<void> {
    if (pathnames.length === 0) return;
    const { del } = await import("@vercel/blob");
    await del(pathnames.map((p) => `${this.prefix}/${safePath(p)}`));
  }
}

let instance: Blobs | undefined;

export function blobs(): Blobs {
  if (instance) return instance;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    instance = new VercelBlobs();
  } else {
    const base =
      process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "development"
        ? "/tmp/bezbot-blobs"
        : path.join(process.env.BEZBOT_DATA_DIR ?? path.join(findProjectRoot(), ".data"), "blobs");
    instance = new FileBlobs(base);
  }
  return instance;
}
