import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { DeliveryClaims } from "./protocol";

export const SESSION_COOKIE = "bezbot_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

let warned = false;

/** Secret for signing cookies, internal tokens, and encrypting the vault. */
export function appSecret(): string {
  const secret = process.env.BEZBOT_SECRET ?? process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  // Fail closed in any production runtime (self-hosted or any Vercel environment):
  // the fallback below is public, so nothing signed or encrypted with it is safe.
  const production =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";
  if (production) {
    throw new Error("Set BEZBOT_SECRET (32+ random characters) before running Bez Bot in production.");
  }
  if (!warned) {
    warned = true;
    console.warn("[bezbot] BEZBOT_SECRET is not set; using an insecure development secret.");
  }
  return "bezbot-insecure-development-secret-change-me";
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", appSecret()).update(payload).digest("base64url");
}

export interface SessionClaims {
  uid: string;
  exp: number;
}

export function createSessionToken(userId: string): string {
  const claims: SessionClaims = { uid: userId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const payload = b64url(JSON.stringify(claims));
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionClaims | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaims;
    if (typeof claims.uid !== "string" || claims.exp < Date.now() / 1000) return null;
    return claims;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

// ---------------------------------------------------------------------------
// Passwords: scrypt with a random salt per password.
// ---------------------------------------------------------------------------

export const PASSWORD_MIN_LENGTH = 8;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function scryptKey(password: string, salt: Buffer, params: { N: number; r: number; p: number; keylen: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, params.keylen, { N: params.N, r: params.r, p: params.p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptKey(password, salt, SCRYPT);
  return `scrypt.${SCRYPT.N}.${SCRYPT.r}.${SCRYPT.p}.${b64url(salt)}.${b64url(key)}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [scheme, n, r, p, salt, key] = (stored ?? "").split(".");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await scryptKey(password, Buffer.from(salt, "base64url"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    keylen: expected.length,
  });
  return timingSafeEqual(expected, actual);
}

export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

const DELIVERY_TTL_SECONDS = 5 * 60;

/**
 * Credential that lets trusted server code post into a Bot's conversation on
 * the user's behalf. The eve channel turns it into the turn's auth, so the
 * turn's source (routine, teammate, group) can't be claimed by message text.
 */
export function signDelivery(claims: Omit<DeliveryClaims, "exp">): string {
  const payload = b64url(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + DELIVERY_TTL_SECONDS }));
  return `${payload}.${sign(`delivery:${payload}`)}`;
}

export function verifyDelivery(token: string | null | undefined): DeliveryClaims | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(`delivery:${payload}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DeliveryClaims;
    if (typeof claims.uid !== "string" || typeof claims.bot !== "string" || claims.exp < Date.now() / 1000) return null;
    return claims;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Vault encryption: AES-256-GCM with a key derived from the app secret.
// ---------------------------------------------------------------------------

function vaultKey(userId: string): Buffer {
  return createHash("sha256").update(`vault:${userId}:${appSecret()}`).digest();
}

export function encryptSecret(userId: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(userId), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${b64url(iv)}.${b64url(tag)}.${b64url(ciphertext)}`;
}

export function decryptSecret(userId: string, sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unsupported vault entry.");
  const decipher = createDecipheriv("aes-256-gcm", vaultKey(userId), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
