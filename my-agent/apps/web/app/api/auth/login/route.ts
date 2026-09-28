import { cookies } from "next/headers";
import { z } from "zod";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@shared/auth";
import { isValidTimeZone } from "@shared/schedule";
import { createUser, updateUser } from "@shared/store/repo";
import { bad, json } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().max(80).default(""),
  email: z.string().trim().email(),
  timezone: z.string().optional(),
  next: z.string().optional(),
});

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

/**
 * Passwordless demo sign-in: an email identifies the workspace. Swap this for
 * your identity provider (Auth.js, Clerk, WorkOS…) in production; everything
 * downstream only relies on the signed session cookie.
 *
 * Accepts JSON (from the hydrated form) or a plain form post (before
 * hydration), which redirects instead of returning JSON.
 */
export async function POST(request: Request) {
  const isForm = (request.headers.get("content-type") ?? "").includes("form");
  let raw: unknown;
  try {
    raw = isForm ? Object.fromEntries((await request.formData()).entries()) : await request.json();
  } catch {
    return bad("Expected a form or JSON body.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    if (isForm) return Response.redirect(new URL("/login?error=email", request.url), 303);
    return bad("Enter a valid email address.");
  }
  const body = parsed.data;
  const timezone = body.timezone && isValidTimeZone(body.timezone) ? body.timezone : "UTC";
  let user = await createUser({ name: body.name, email: body.email, timezone });
  if (!user.timezone && timezone) user = (await updateUser(user.id, { timezone })) ?? user;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions());
  if (isForm) return Response.redirect(new URL(safeNext(body.next), request.url), 303);
  return json({ user });
}
