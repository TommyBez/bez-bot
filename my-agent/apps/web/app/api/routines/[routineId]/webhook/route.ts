import { timingSafeEqual } from "node:crypto";
import { runRoutine } from "@shared/routines";
import { getRoutine } from "@shared/store/repo";
import { bad, json } from "@/lib/http";

function sameKey(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Webhook trigger: `POST` with `Authorization: Bearer <key>` starts a run. An
 * optional JSON body is passed to the Bot with the instruction. A 200 means
 * the run was accepted; check the Bot's chat for the result.
 */
export async function POST(request: Request, { params }: { params: Promise<{ routineId: string }> }) {
  const routine = await getRoutine((await params).routineId);
  const key = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]?.trim();
  if (!routine || !key || !sameKey(key, routine.webhookKey)) return bad("Unauthorized", 401);
  if (!routine.enabled) return bad("This routine is paused.", 409);
  const raw = await request.text();
  let payload: string | undefined;
  if (raw.trim()) {
    try {
      payload = JSON.stringify(JSON.parse(raw), null, 2).slice(0, 16_000);
    } catch {
      return bad("Body must be JSON.");
    }
  }
  const run = await runRoutine(routine, "webhook", payload);
  return run ? json({ ok: true, runId: run.id }) : bad("Couldn't start a run.", 409);
}
