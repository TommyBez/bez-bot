import { ensureBotSession } from "@shared/delivery";
import { createBot, listBots } from "@shared/store/repo";
import type { Bot, User } from "@shared/store/types";

/** Every account starts with one general-purpose Bot named after the product. */
export async function ensureFirstBot(user: User): Promise<Bot[]> {
  const bots = await listBots(user.id);
  if (bots.length > 0) return bots;
  const bot = await createBot(
    user.id,
    {
      name: "Bez Bot",
      label: "Your first teammate",
      description:
        "You're the user's first Bez Bot. Help with anything they hand you, learn how they work, and suggest a focused Bot (with create_bot) when a job deserves its own long-lived owner.",
      emoji: "🤖",
      color: "#e5e5e5",
    },
    user.timezone ?? "UTC",
  );
  await ensureBotSession(bot).catch(() => undefined);
  return [bot];
}
