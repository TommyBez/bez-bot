import { notFound } from "next/navigation";
import { BotWorkspace } from "@/components/app/bot-workspace";
import { requireUser } from "@/lib/session";
import { getOwnedBot } from "@shared/store/repo";

/** A fresh task with this bot. Earlier tasks are listed in the workspace sidebar. */
export default async function BotPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ botId: string }>;
  readonly searchParams: Promise<{ n?: string }>;
}) {
  const [{ botId }, { n }] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const bot = await getOwnedBot(user.id, botId);
  if (!bot) notFound();
  return <BotWorkspace bot={bot} newKey={n} />;
}
