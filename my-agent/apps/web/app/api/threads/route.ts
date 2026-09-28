import { z } from "zod";
import { createThread, listThreads } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  return json({ threads: await listThreads(user.id) });
}

const schema = z.object({
  title: z.string().max(120).optional(),
  memberBotIds: z.array(z.string()).min(1).max(12),
  leadBotId: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, schema);
  if (body instanceof Response) return body;
  try {
    return json({ thread: await createThread(user.id, body) }, { status: 201 });
  } catch (error) {
    return bad(error instanceof Error ? error.message : "Could not create thread.");
  }
}
