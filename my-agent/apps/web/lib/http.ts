import { z } from "zod";

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T> | Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return bad("Expected a JSON body.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return bad(result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  }
  return result.data;
}
