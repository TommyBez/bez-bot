import { z } from "zod";
import { encryptSecret } from "@shared/auth";
import { deleteVaultEntry, listVault, saveVaultEntry } from "@shared/store/repo";
import { json, parseBody } from "@/lib/http";
import { userOr401 } from "@/lib/session";

/** Saved logins. Secrets are encrypted at rest and never returned to any client. */
export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const entries = await listVault(user.id);
  return json({ entries: entries.map(({ secret: _secret, ...rest }) => rest) });
}

const schema = z.object({
  label: z.string().trim().min(1).max(80),
  site: z.string().trim().min(3).max(200),
  username: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(500),
  notes: z.string().max(400).optional(),
});

export async function POST(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const body = await parseBody(request, schema);
  if (body instanceof Response) return body;
  const entry = await saveVaultEntry(user.id, {
    label: body.label,
    site: body.site,
    username: body.username,
    notes: body.notes,
    secret: encryptSecret(user.id, body.password),
  });
  const { secret: _secret, ...rest } = entry;
  return json({ entry: rest }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const id = new URL(request.url).searchParams.get("id");
  if (id) await deleteVaultEntry(user.id, id);
  return json({ ok: true });
}
