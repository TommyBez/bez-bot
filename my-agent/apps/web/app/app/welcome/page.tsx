import { redirect } from "next/navigation";
import { ensureFirstBot } from "@/lib/first-bot";
import { requireUser } from "@/lib/session";
import { Welcome } from "./welcome";

export default async function WelcomePage() {
  const user = await requireUser("/app/welcome");
  const bots = await ensureFirstBot(user);
  if (user.onboardedAt) redirect(`/app/bots/${bots[0]!.id}`);
  return <Welcome firstBotId={bots[0]!.id} />;
}
