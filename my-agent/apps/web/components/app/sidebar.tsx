"use client";

import {
  BrainIcon,
  CalendarClockIcon,
  HashIcon,
  HomeIcon,
  InboxIcon,
  LogOutIcon,
  MenuIcon,
  MonitorIcon,
  NetworkIcon,
  PlusIcon,
  SettingsIcon,
  StoreIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType } from "react";
import { BezLogo, BotAvatar, botStatusLabel } from "@/components/bez/bot-avatar";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { useAppState } from "./app-state";

function NavLink({
  href,
  icon: Icon,
  label,
  badge,
  active,
  onNavigate,
}: {
  readonly href: string;
  readonly icon: ComponentType<{ className?: string }>;
  readonly label: string;
  readonly badge?: number;
  readonly active: boolean;
  readonly onNavigate?: () => void;
}) {
  return (
    <Link
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13.5px] transition-colors",
        active ? "bg-white/[0.08] text-white" : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100",
      )}
      href={href}
      onClick={onNavigate}
    >
      <Icon className="size-4" />
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="min-w-5 rounded-full bg-white px-1.5 text-center text-[11px] font-medium text-black">{badge > 99 ? "99+" : badge}</span>
      ) : null}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { readonly onNavigate?: () => void }) {
  const { state } = useAppState();
  const pathname = usePathname();
  const is = (href: string, exact = false) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/app" onClick={onNavigate}>
          <BezLogo className="text-[14px]" />
        </Link>
        <Link
          aria-label="New bot"
          className="flex size-7 items-center justify-center rounded-lg border border-white/10 text-neutral-400 hover:border-white/25 hover:text-white"
          href="/app/bots/new"
          onClick={onNavigate}
        >
          <PlusIcon className="size-4" />
        </Link>
      </div>

      <nav className="space-y-0.5 px-2">
        <NavLink active={is("/app", true)} href="/app" icon={HomeIcon} label="Home" onNavigate={onNavigate} />
        <NavLink active={is("/app/inbox")} badge={state.unread} href="/app/inbox" icon={InboxIcon} label="Inbox" onNavigate={onNavigate} />
        <NavLink active={is("/app/network")} href="/app/network" icon={NetworkIcon} label="Bot network" onNavigate={onNavigate} />
        <NavLink active={is("/app/routines")} href="/app/routines" icon={CalendarClockIcon} label="Routines" onNavigate={onNavigate} />
        <NavLink active={is("/app/computer")} href="/app/computer" icon={MonitorIcon} label="Computer" onNavigate={onNavigate} />
        <NavLink active={is("/app/memory")} href="/app/memory" icon={BrainIcon} label="Memory" onNavigate={onNavigate} />
      </nav>

      <div className="mt-5 flex items-center justify-between px-4 pb-1">
        <span className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">Bots</span>
        <Link className="text-neutral-500 hover:text-white" href="/app/bots/new" onClick={onNavigate}>
          <PlusIcon className="size-3.5" />
        </Link>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2">
        <ul className="space-y-0.5">
          {state.bots.map((bot) => (
            <li key={bot.id}>
              <Link
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors",
                  is(`/app/bots/${bot.id}`) ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
                )}
                href={`/app/bots/${bot.id}`}
                onClick={onNavigate}
              >
                <BotAvatar color={bot.color} emoji={bot.emoji} name={bot.name} size="sm" status={bot.status} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-neutral-100">{bot.name}</span>
                  <span
                    className={cn(
                      "block truncate text-[11.5px]",
                      bot.status === "working" ? "text-emerald-400/80" : bot.status === "waiting" ? "text-amber-300/80" : "text-neutral-500",
                    )}
                  >
                    {botStatusLabel(bot.status, bot.statusText)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {state.bots.length === 0 ? (
            <li className="px-2 py-2 text-[12.5px] text-neutral-500">No bots yet.</li>
          ) : null}
        </ul>

        <div className="mt-5 flex items-center justify-between px-2 pb-1">
          <span className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">Threads</span>
          <Link className="text-neutral-500 hover:text-white" href="/app/threads/new" onClick={onNavigate}>
            <PlusIcon className="size-3.5" />
          </Link>
        </div>
        <ul className="space-y-0.5 pb-4">
          {state.threads.map((thread) => (
            <li key={thread.id}>
              <Link
                className={cn(
                  "flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[13px] transition-colors",
                  is(`/app/threads/${thread.id}`) ? "bg-white/[0.08] text-white" : "text-neutral-400 hover:bg-white/[0.04] hover:text-white",
                )}
                href={`/app/threads/${thread.id}`}
                onClick={onNavigate}
              >
                <HashIcon className="size-3.5 shrink-0" />
                <span className="truncate">{thread.title}</span>
              </Link>
            </li>
          ))}
          {state.threads.length === 0 ? (
            <li>
              <Link className="block px-2.5 py-1.5 text-[12.5px] text-neutral-500 hover:text-white" href="/app/threads/new" onClick={onNavigate}>
                Put a few bots in a thread →
              </Link>
            </li>
          ) : null}
        </ul>
      </div>

      <div className="space-y-0.5 border-t border-white/[0.06] p-2">
        <NavLink active={is("/marketplace")} href="/marketplace" icon={StoreIcon} label="Marketplace" onNavigate={onNavigate} />
        <NavLink active={is("/app/settings")} href="/app/settings" icon={SettingsIcon} label="Settings" onNavigate={onNavigate} />
        <button
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13.5px] text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"
          onClick={async () => {
            await api("/api/auth/logout", { method: "POST" });
            window.location.assign("/");
          }}
          type="button"
        >
          <LogOutIcon className="size-4" />
          <span className="flex-1 truncate text-left">Sign out {state.user.name}</span>
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-white/[0.06] bg-[#050505] md:block">
        <SidebarContent />
      </aside>
      <button
        aria-label="Open menu"
        className="fixed top-3 left-3 z-40 flex size-9 items-center justify-center rounded-xl border border-white/10 bg-black/80 text-neutral-300 backdrop-blur md:hidden"
        onClick={() => setOpen(true)}
        type="button"
      >
        <MenuIcon className="size-4" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} type="button" />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-white/10 bg-[#050505]">
            <button
              aria-label="Close"
              className="absolute top-3.5 right-3 text-neutral-500 hover:text-white"
              onClick={() => setOpen(false)}
              type="button"
            >
              <XIcon className="size-4" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
