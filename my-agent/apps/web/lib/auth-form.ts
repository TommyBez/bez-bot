import { cookies } from "next/headers";
import { createSessionToken, PASSWORD_MIN_LENGTH, SESSION_COOKIE, sessionCookieOptions } from "@shared/auth";
import type { User } from "@shared/store/types";
import { bad, json } from "@/lib/http";
import { safeRedirectPath } from "@/lib/redirect";

export type AuthMode = "signin" | "signup";

export const AUTH_ERRORS = {
  invalid: `Enter a valid email and a password of at least ${PASSWORD_MIN_LENGTH} characters.`,
  credentials: "Incorrect email or password.",
  exists: "An account with this email already exists. Sign in instead.",
  locked: "Too many failed attempts. Try again in 15 minutes.",
} as const;

export type AuthError = keyof typeof AUTH_ERRORS;

export function authErrorMessage(code: string | undefined): string | undefined {
  return code && code in AUTH_ERRORS ? AUTH_ERRORS[code as AuthError] : undefined;
}

/**
 * Sign-in and sign-up accept JSON (from the hydrated form) or a plain form
 * post (before hydration), which gets redirects instead of JSON.
 */
export async function readAuthBody(request: Request): Promise<{ isForm: boolean; raw: Record<string, unknown> } | null> {
  const isForm = (request.headers.get("content-type") ?? "").includes("form");
  try {
    const raw: unknown = isForm ? Object.fromEntries((await request.formData()).entries()) : await request.json();
    return raw && typeof raw === "object" ? { isForm, raw: raw as Record<string, unknown> } : null;
  } catch {
    return null;
  }
}

export function authFailure(
  request: Request,
  body: { isForm: boolean; raw: Record<string, unknown> },
  mode: AuthMode,
  error: AuthError,
  status = 400,
): Response {
  if (!body.isForm) return bad(AUTH_ERRORS[error], status);
  const params = new URLSearchParams({ mode, error });
  if (typeof body.raw.next === "string") params.set("next", safeRedirectPath(body.raw.next));
  return Response.redirect(new URL(`/login?${params}`, request.url), 303);
}

export async function signedIn(request: Request, body: { isForm: boolean; raw: Record<string, unknown> }, user: User): Promise<Response> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions());
  if (!body.isForm) return json({ user });
  const next = typeof body.raw.next === "string" ? body.raw.next : undefined;
  return Response.redirect(new URL(safeRedirectPath(next), request.url), 303);
}
