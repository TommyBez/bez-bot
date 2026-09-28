import { z } from "zod";
import { hashPassword, PASSWORD_MIN_LENGTH } from "@shared/auth";
import { isValidTimeZone } from "@shared/schedule";
import { createUser } from "@shared/store/repo";
import { authFailure, readAuthBody, signedIn } from "@/lib/auth-form";
import { bad } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().max(80).default(""),
  email: z.string().trim().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
  timezone: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await readAuthBody(request);
  if (!body) return bad("Expected a form or JSON body.");
  const parsed = schema.safeParse(body.raw);
  if (!parsed.success) return authFailure(request, body, "signup", "invalid");
  const { name, email, password } = parsed.data;
  const timezone = parsed.data.timezone && isValidTimeZone(parsed.data.timezone) ? parsed.data.timezone : "UTC";
  const user = await createUser({ name, email, timezone, passwordHash: await hashPassword(password) });
  if (!user) return authFailure(request, body, "signup", "exists", 409);
  return signedIn(request, body, user);
}
