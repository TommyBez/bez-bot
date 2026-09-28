import { notFound } from "next/navigation";
import { GroupChat } from "@/components/app/group/group-chat";
import { requireUser } from "@/lib/session";
import { getOwnedGroup } from "@shared/store/repo";

export default async function GroupPage({ params }: { readonly params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const user = await requireUser(`/app/groups/${groupId}`);
  const group = await getOwnedGroup(user.id, groupId);
  if (!group) notFound();
  return <GroupChat group={group} key={group.id} />;
}
