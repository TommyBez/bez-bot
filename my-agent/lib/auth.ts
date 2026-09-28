import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "bezbot_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

let warned = false;

/** Secret for signing cookies, internal tokens, and encrypting the vault. */
export function appSecret(): string {
  const secret = process.env.BEZBOT_SECRET ?? process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production") {
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

export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** HMAC token for server-to-server calls between the app and the agent. */
export function internalToken(purpose: string): string {
  return createHmac("sha256", appSecret()).update(`internal:${purpose}`).digest("base64url");
}

export function verifyInternalToken(purpose: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(internalToken(purpose));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
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
