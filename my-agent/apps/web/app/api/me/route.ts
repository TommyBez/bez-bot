import { z } from "zod";
import { isValidTimeZone } from "@shared/schedule";
import { updateUser } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  return json({ user });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().optional(),
  onboarded: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, patchSchema);
  if (body instanceof Response) return body;
  if (body.timezone && !isValidTimeZone(body.timezone)) return bad("Unknown timezone.");
  const { onboarded, ...patch } = body;
  return json({ user: await updateUser(user.id, { ...patch, ...(onboarded ? { onboardedAt: new Date().toISOString() } : {}) }) });
}
