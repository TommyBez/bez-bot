import { z } from "zod";
import { createRoutine, listRoutines } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { scheduleSchema } from "@/lib/schemas";
import { userOr401 } from "@/lib/session";

export async function GET(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const botId = new URL(request.url).searchParams.get("botId") ?? undefined;
  return json({ routines: await listRoutines(user.id, botId) });
}

const schema = z.object({
  botId: z.string(),
  name: z.string().trim().min(2).max(80),
  description: z.string().max(400).default(""),
  steps: z.string().trim().min(5).max(8000),
  schedule: scheduleSchema.optional(),
  enabled: z.boolean().default(true),
});

export async function POST(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, schema);
  if (body instanceof Response) return body;
  try {
    const hasSchedule = Boolean(body.schedule && (body.schedule.at || body.schedule.everyMinutes));
    const routine = await createRoutine(user.id, {
      ...body,
      source: "manual",
      schedule: hasSchedule
        ? {
            everyMinutes: body.schedule?.everyMinutes ?? null,
            at: body.schedule?.at ?? null,
            days: body.schedule?.days ?? null,
            timezone: user.timezone ?? "UTC",
          }
        : null,
    });
    return json({ routine }, { status: 201 });
  } catch (error) {
    return bad(error instanceof Error ? error.message : "Could not create routine.");
  }
}
