import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOwnedBot } from "@shared/store/repo";
import { BotSettings } from "./bot-settings";

export default async function BotSettingsPage({ params }: { readonly params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const user = await requireUser();
  const bot = await getOwnedBot(user.id, botId);
  if (!bot) notFound();
  return <BotSettings bot={bot} />;
}
