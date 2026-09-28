import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@shared/auth";
import { getUser } from "@shared/store/repo";
import type { User } from "@shared/store/types";

/** The signed-in user for server components and route handlers, or null. */
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const claims = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  return getUser(claims.uid);
}

export async function requireUser(next?: string): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

/** For route handlers: returns the user or a 401 response. */
export async function userOr401(): Promise<User | Response> {
  const user = await currentUser();
  return user ?? Response.json({ error: "Sign in required." }, { status: 401 });
}
