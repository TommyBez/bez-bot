import { z } from "zod";
import { deleteRoutine, getRoutine, queueRoutineNow, updateRoutine } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { scheduleSchema } from "@/lib/schemas";
import { userOr401 } from "@/lib/session";

type Params = { params: Promise<{ routineId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const { routineId } = await params;
  const routine = await getRoutine(routineId);
  if (!routine || routine.userId !== user.id) return bad("Not found", 404);
  return json({ routine });
}

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().max(400).optional(),
  steps: z.string().trim().min(5).max(8000).optional(),
  schedule: scheduleSchema.optional(),
  enabled: z.boolean().optional(),
  runNow: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const { routineId } = await params;
  const body = await parseBody(request, schema);
  if (body instanceof Response) return body;
  const { runNow, schedule, ...patch } = body;
  if (runNow) {
    const queued = await queueRoutineNow(user.id, routineId);
    return queued ? json({ routine: queued }) : bad("Not found", 404);
  }
  const routine = await updateRoutine(user.id, routineId, {
    ...patch,
    ...(schedule === undefined
      ? {}
      : {
          schedule:
            schedule && (schedule.at || schedule.everyMinutes)
              ? { everyMinutes: schedule.everyMinutes ?? null, at: schedule.at ?? null, days: schedule.days ?? null, timezone: user.timezone ?? "UTC" }
              : null,
        }),
  });
  return routine ? json({ routine }) : bad("Not found", 404);
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const { routineId } = await params;
  return (await deleteRoutine(user.id, routineId)) ? json({ ok: true }) : bad("Not found", 404);
}
