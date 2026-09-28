import { kv } from "@shared/store/kv";
import { blobs } from "@shared/store/blobs";
import { bad } from "@/lib/http";
import { userOr401 } from "@/lib/session";

const TEXT = /\.(md|txt|csv|json|ts|tsx|js|py|html|css|yml|yaml|log|sh|sql|xml)$/i;

/** Downloads one file from the user's shared drive. */
export async function GET(request: Request) {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!path || path.includes("..")) return bad("Invalid path.");
  const manifest = await kv().get<{ files: Record<string, unknown> }>(`computer-manifest:${user.id}`);
  if (!manifest?.files[path]) return bad("Not found", 404);
  const data = await blobs().get(`computers/${user.id}/${path}`);
  if (!data) return bad("Not found", 404);
  const name = path.split("/").pop() ?? "file";
  return new Response(Buffer.from(data), {
    headers: {
      "content-type": TEXT.test(path) ? "text/plain; charset=utf-8" : "application/octet-stream",
      "content-disposition": `inline; filename="${name.replace(/"/g, "")}"`,
      "cache-control": "no-store",
    },
  });
}
