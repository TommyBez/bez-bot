import { z } from "zod";
import { verifyPassword } from "@shared/auth";
import { isValidTimeZone } from "@shared/schedule";
import { clearSignInFailures, findUserByEmail, getPasswordHash, recordSignInFailure, signInLocked, updateUser } from "@shared/store/repo";
import { authFailure, readAuthBody, signedIn } from "@/lib/auth-form";
import { bad } from "@/lib/http";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
  timezone: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await readAuthBody(request);
  if (!body) return bad("Expected a form or JSON body.");
  const parsed = schema.safeParse(body.raw);
  if (!parsed.success) return authFailure(request, body, "signin", "credentials", 401);
  const { email, password, timezone } = parsed.data;
  if (await signInLocked(email)) return authFailure(request, body, "signin", "locked", 429);

  let user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, await getPasswordHash(user.id)))) {
    if (user) await recordSignInFailure(email);
    return authFailure(request, body, "signin", "credentials", 401);
  }
  await clearSignInFailures(email);
  if (!user.timezone && timezone && isValidTimeZone(timezone)) user = (await updateUser(user.id, { timezone })) ?? user;
  return signedIn(request, body, user);
}
