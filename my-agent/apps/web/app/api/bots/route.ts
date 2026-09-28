import { z } from "zod";
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
  job: z.string().trim().max(140).optional(),
  description: z.string().trim().max(600).optional(),
  instructions: z.string().max(8000).optional(),
  emoji: z.string().max(8).optional(),
  color: z.string().max(20).optional(),
  templateId: z.string().optional(),
  autoReview: z.enum(["auto", "always", "off"]).optional(),
  autonomous: z.boolean().optional(),
  installRoutines: z.boolean().optional(),
});

export async function POST(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, createSchema);
  if (body instanceof Response) return body;
  const bot = await createBot(user.id, body, user.timezone ?? "UTC");
  return json({ bot }, { status: 201 });
}
