import { z } from "zod";
import { addMemory, editMemory, getMemory, listBots, removeMemory, TEAM_MEMORY } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const bots = await listBots(user.id);
  const [team, ...perBot] = await Promise.all([
    getMemory(user.id, TEAM_MEMORY),
    ...bots.map((b) => getMemory(user.id, b.id)),
  ]);
  return json({
    team,
    bots: bots.map((bot, i) => ({ botId: bot.id, name: bot.name, emoji: bot.emoji, color: bot.color, memory: perBot[i] })),
  });
}

async function ownsScope(userId: string, scope: string) {
  if (scope === TEAM_MEMORY) return true;
  return (await listBots(userId)).some((b) => b.id === scope);
}

const addSchema = z.object({ scope: z.string(), text: z.string().trim().min(2).max(1200) });

export async function POST(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, addSchema);
  if (body instanceof Response) return body;
  if (!(await ownsScope(user.id, body.scope))) return bad("Unknown scope.", 404);
  return json({ entry: await addMemory(user.id, body.scope, { text: body.text, source: "user" }) }, { status: 201 });
}

const editSchema = z.object({ scope: z.string(), id: z.string(), text: z.string().trim().min(2).max(1200) });

export async function PATCH(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, editSchema);
  if (body instanceof Response) return body;
  if (!(await ownsScope(user.id, body.scope))) return bad("Unknown scope.", 404);
  return json({ ok: await editMemory(user.id, body.scope, body.id, body.text) });
}

const deleteSchema = z.object({ scope: z.string(), id: z.string() });

export async function DELETE(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, deleteSchema);
  if (body instanceof Response) return body;
  if (!(await ownsScope(user.id, body.scope))) return bad("Unknown scope.", 404);
  return json({ ok: await removeMemory(user.id, body.scope, body.id) });
}
