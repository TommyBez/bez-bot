import { getComputer } from "@shared/store/repo";
import { json } from "@/lib/http";
import { userOr401 } from "@/lib/session";

export async function GET() {
  const user = await userOr401();
  if (user instanceof Response) return user;
  const computer = await getComputer(user.id);
  return json({
    computer: computer ?? { userId: user.id, sandboxKind: "not started", files: [], activity: [], snapshotBytes: 0, updatedAt: null },
    desktop: process.env.VERCEL === "1" || process.env.BEZBOT_SANDBOX === "vercel",
  });
}
