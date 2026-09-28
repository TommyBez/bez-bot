import { cookies } from "next/headers";
import { z } from "zod";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@shared/auth";
import { isValidTimeZone } from "@shared/schedule";
import { createUser, updateUser } from "@shared/store/repo";
import { json, parseBody } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().max(80).default(""),
  email: z.string().trim().email(),
  timezone: z.string().optional(),
});

/**
 * Passwordless demo sign-in: an email identifies the workspace. Swap this for
 * your identity provider (Auth.js, Clerk, WorkOS…) in production; everything
 * downstream only relies on the signed session cookie.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, schema);
  if (body instanceof Response) return body;
  const timezone = body.timezone && isValidTimeZone(body.timezone) ? body.timezone : "UTC";
  let user = await createUser({ name: body.name, email: body.email, timezone });
  if (!user.timezone && timezone) user = (await updateUser(user.id, { timezone })) ?? user;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions());
  return json({ user });
}
