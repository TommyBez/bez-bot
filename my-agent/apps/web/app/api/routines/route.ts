import { listRoutines } from "@shared/store/repo";
import { json } from "@/lib/http";
import { userOr401 } from "@/lib/session";

/** Routines are created by asking a Bot in chat; this lists them. */
export async function GET(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const botId = new URL(request.url).searchParams.get("botId") ?? undefined;
  return json({ routines: await listRoutines(user.id, botId) });
}
