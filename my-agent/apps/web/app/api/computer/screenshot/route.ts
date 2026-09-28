import { blobs } from "@shared/store/blobs";
import { userOr401 } from "@/lib/session";

/** Latest desktop screenshot captured after the bots' last computer action. */
export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const data = await blobs().get(`screens/${user.id}/latest.png`);
  if (!data) return new Response(null, { status: 404 });
  return new Response(Buffer.from(data), { headers: { "content-type": "image/png", "cache-control": "no-store" } });
}
