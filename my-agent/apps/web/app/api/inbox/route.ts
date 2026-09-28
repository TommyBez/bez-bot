import { z } from "zod";
import { listInbox, markInboxRead } from "@shared/store/repo";
import { json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const items = await listInbox(user.id);
  return json({ items, unread: items.filter((i) => !i.read).length });
}

const schema = z.object({ ids: z.union([z.array(z.string()), z.literal("all")]) });

export async function POST(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, schema);
  if (body instanceof Response) return body;
  await markInboxRead(user.id, body.ids);
  return json({ ok: true });
}
