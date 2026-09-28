import { notFound } from "next/navigation";
import { BotWorkspace } from "@/components/app/bot-workspace";
import { requireUser } from "@/lib/session";
import { getConversation, getOwnedBot } from "@shared/store/repo";

export default async function ConversationPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ botId: string; conversationId: string }>;
  readonly searchParams: Promise<{ record?: string }>;
}) {
  const [{ botId, conversationId }, { record }] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const [bot, conversation] = await Promise.all([getOwnedBot(user.id, botId), getConversation(conversationId)]);
  if (!bot || !conversation || conversation.userId !== user.id || conversation.botId !== bot.id) notFound();
  return <BotWorkspace autoRecord={record === "1"} bot={bot} conversation={conversation} />;
}
