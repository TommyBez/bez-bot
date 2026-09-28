import { z } from "zod";
import { ensureBotSession } from "@shared/delivery";
import { createBot, listBots } from "@shared/store/repo";
import { json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  return json({ bots: await listBots(user.id) });
}

const createSchema = z.object({
  name: z.string().trim().max(60).default(""),
  label: z.string().trim().max(140).optional(),
  description: z.string().max(8000).optional(),
  emoji: z.string().max(8).optional(),
  color: z.string().max(20).optional(),
  templateId: z.string().optional(),
});

/** Creates a Bot and its one conversation. */
export async function POST(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, createSchema);
  if (body instanceof Response) return body;
  const bot = await createBot(user.id, body, user.timezone ?? "UTC");
  const sessionId = await ensureBotSession(bot).catch((error: unknown) => {
    console.warn("[bezbot] could not create the conversation yet", error);
    return undefined;
  });
  return json({ bot: { ...bot, sessionId } }, { status: 201 });
}
