import { z } from "zod";
import { runRoutine } from "@shared/routines";
import { deleteRoutine, getRoutine, updateRoutine } from "@shared/store/repo";
import { bad, json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

type Params = { params: Promise<{ routineId: string }> };

async function owned(userId: string, params: Params["params"]) {
  const routine = await getRoutine((await params).routineId);
  return routine && routine.userId === userId ? routine : null;
}

export async function GET(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const routine = await owned(user.id, params);
  return routine ? json({ routine }) : bad("Not found", 404);
}

const patchSchema = z.object({ enabled: z.boolean() });

/** Pause or resume. Editing the instruction or schedule happens by asking the Bot. */
export async function PATCH(request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, patchSchema);
  if (body instanceof Response) return body;
  const routine = await owned(user.id, params);
  if (!routine) return bad("Not found", 404);
  return json({ routine: await updateRoutine(user.id, routine.id, { enabled: body.enabled }) });
}

/** Test: runs the routine now for real. The result shows up in the Bot's chat. */
export async function POST(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const routine = await owned(user.id, params);
  if (!routine) return bad("Not found", 404);
  try {
    const run = await runRoutine(routine, "test");
    return run ? json({ run }, { status: 202 }) : bad("Couldn't start a test run.", 409);
  } catch (error) {
    return bad(error instanceof Error ? `Couldn't start a test run. ${error.message}` : "Couldn't start a test run.", 502);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const routine = await owned(user.id, params);
  if (!routine) return bad("Not found", 404);
  await deleteRoutine(user.id, routine.id);
  return json({ ok: true });
}
