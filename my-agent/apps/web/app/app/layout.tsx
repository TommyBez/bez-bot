import type { ReactNode } from "react";
import { AppStateProvider } from "@/components/app/app-state";
import { Sidebar } from "@/components/app/sidebar";
import { requireUser } from "@/lib/session";
import { listBots, listConversations, listInbox, listThreads } from "@shared/store/repo";

export const metadata = { title: "App" };

export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const user = await requireUser("/app");
  const [bots, threads, conversations, inbox] = await Promise.all([
    listBots(user.id),
    listThreads(user.id),
    listConversations(user.id),
    listInbox(user.id),
  ]);
  return (
    <AppStateProvider
      initial={{ user, bots, threads, conversations: conversations.slice(0, 40), unread: inbox.filter((i) => !i.read).length }}
    >
      <div className="flex h-dvh overflow-hidden bg-black text-white">
        <Sidebar />
        <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </AppStateProvider>
  );
}
