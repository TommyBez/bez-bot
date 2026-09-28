import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getThread, listBots } from "@shared/store/repo";
import { ThreadView } from "./thread-view";

export default async function ThreadPage({ params }: { readonly params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const user = await requireUser();
  const [thread, bots] = await Promise.all([getThread(threadId), listBots(user.id)]);
  if (!thread || thread.userId !== user.id) notFound();
  const members = thread.memberBotIds.map((id) => bots.find((b) => b.id === id)).filter((b) => b !== undefined);
  const lead = bots.find((b) => b.id === thread.leadBotId) ?? members[0];
  if (!lead) notFound();
  return <ThreadView lead={lead} members={members} thread={thread} />;
}
