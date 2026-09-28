import { notFound } from "next/navigation";
import { BotChat } from "@/components/app/chat/bot-chat";
import type { DetailsTab } from "@/components/app/chat/details-panel";
import { requireUser } from "@/lib/session";
import { ensureBotSession } from "@shared/delivery";
import { getOwnedBot } from "@shared/store/repo";
import { RetryConversation } from "./retry";

export default async function BotPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ botId: string }>;
  readonly searchParams: Promise<{ details?: string }>;
}) {
  const [{ botId }, { details }] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/app/bots/${botId}`);
  const bot = await getOwnedBot(user.id, botId);
  if (!bot) notFound();
  let sessionId = bot.sessionId;
  let error: string | undefined;
  if (!sessionId) {
    try {
      sessionId = await ensureBotSession(bot);
    } catch (err) {
      error = err instanceof Error ? err.message : "Couldn't open the conversation.";
    }
  }
  if (!sessionId) return <RetryConversation botId={bot.id} message={error} name={bot.name} />;
  const tab: DetailsTab | undefined = details === "settings" || details === "tasks" || details === "memory" ? details : undefined;
  return <BotChat bot={{ ...bot, sessionId }} initialDetails={tab} key={bot.id} sessionId={sessionId} />;
}
