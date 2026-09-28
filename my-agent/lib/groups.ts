import { deliverToGroupSeat } from "./delivery";
import { findMentions, formatGroupMessage } from "./protocol";
import { appendGroupMessage, getOwnedGroup, getUser, listBots, takeUnseenGroupMessages } from "./store/repo";
import { kv } from "./store/kv";
import type { GroupMessage } from "./store/types";

/** Bot-to-Bot hand-offs in a group before someone has to step in. */
const MAX_GROUP_HOPS = 12;

/**
 * Posts a message to a group chat and wakes the members who should see it.
 *
 * - You write normally: every member decides whether the message is theirs.
 * - You @-mention Bots: only they answer. `@everyone` asks every member.
 * - A Bot's post wakes only the members it @-mentions, which is how Bots
 *   pass work among themselves inside the group.
 *
 * Each woken member gets everything said since it last looked, in its own
 * session for this group.
 */
export async function postToGroup(
  userId: string,
  groupId: string,
  author: string,
  text: string,
): Promise<GroupMessage | null> {
  const group = await getOwnedGroup(userId, groupId);
  if (!group) return null;
  const [bots, user] = await Promise.all([listBots(userId), getUser(userId)]);
  const members = bots.filter((b) => group.memberBotIds.includes(b.id));
  const everyone = /(^|\s)@everyone\b/i.test(text);
  const mentions = findMentions(text, members).filter((id) => id !== author);
  const message = await appendGroupMessage({ groupId, author, text, mentions }, { unread: author !== "user" });

  let targets: { botId: string; respond: "must" | "maybe" }[];
  if (author === "user") {
    await kv().set(`group-hops:${groupId}`, 0);
    targets = everyone
      ? members.map((b) => ({ botId: b.id, respond: "must" as const }))
      : mentions.length > 0
        ? mentions.map((botId) => ({ botId, respond: "must" as const }))
        : members.map((b) => ({ botId: b.id, respond: "maybe" as const }));
  } else {
    if (mentions.length === 0) return message;
    let hops = 0;
    await kv().update<number>(`group-hops:${groupId}`, (n) => {
      hops = (n ?? 0) + 1;
      return hops;
    });
    if (hops > MAX_GROUP_HOPS) return message;
    targets = mentions.map((botId) => ({ botId, respond: "must" as const }));
  }

  const nameOf = (id: string) => (id === "user" ? (user?.name ?? "You") : (bots.find((b) => b.id === id)?.name ?? "A Bot"));
  await Promise.all(
    targets.map(async ({ botId, respond }) => {
      const unseen = await takeUnseenGroupMessages(groupId, botId);
      if (unseen.length === 0) return;
      await deliverToGroupSeat(groupId, botId, {
        text: formatGroupMessage(
          { groupId, groupName: group.name, respond },
          unseen.map((m) => ({ author: nameOf(m.author), text: m.text })),
        ),
        claims: { src: "group" },
        dedupeKey: `${message.id}:${botId}`,
      });
    }),
  );
  return message;
}
