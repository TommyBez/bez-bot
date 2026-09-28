import { redirect } from "next/navigation";
import { ensureFirstBot } from "@/lib/first-bot";
import { requireUser } from "@/lib/session";

/** Opens the most recent conversation, like the desktop app does. */
export default async function AppHome() {
  const user = await requireUser("/app");
  const bots = await ensureFirstBot(user);
  if (!user.onboardedAt) redirect("/app/welcome");
  const recent = [...bots]
    .filter((b) => !b.hidden)
    .sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt))[0];
  redirect(`/app/bots/${(recent ?? bots[0]!).id}`);
}
