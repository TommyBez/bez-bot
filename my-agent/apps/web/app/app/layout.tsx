import type { ReactNode } from "react";
import { AppStateProvider } from "@/components/app/app-state";
import { Sidebar } from "@/components/app/sidebar";
import { requireUser } from "@/lib/session";
import { listBots, listGroups } from "@shared/store/repo";

export const metadata = { title: "App" };

export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const user = await requireUser("/app");
  const [bots, groups] = await Promise.all([listBots(user.id), listGroups(user.id)]);
  return (
    <AppStateProvider initial={{ user, bots, groups }}>
      <div className="flex h-dvh overflow-hidden bg-black text-white">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </AppStateProvider>
  );
}
