"use client";

import { BookOpenIcon, ChevronDownIcon, ChevronRightIcon, LogOutIcon, MenuIcon, SearchIcon, SettingsIcon, SquarePenIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { BotMenu, GroupMenu } from "@/components/app/bot-menu";
import { NewChatDialog } from "@/components/app/new-chat-dialog";
import { BezLogo, BotAvatar } from "@/components/bez/bot-avatar";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { api, timeAgo } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Bot, Group } from "@shared/store/types";
import { useAppState } from "./app-state";

function byActivity(a: { lastMessageAt?: string; createdAt: string }, b: { lastMessageAt?: string; createdAt: string }) {
  return (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt);
}

function GroupAvatar({ group, bots }: { readonly group: Group; readonly bots: Bot[] }) {
  const members = group.memberBotIds.map((id) => bots.find((b) => b.id === id)).filter((b): b is Bot => Boolean(b));
  return (
    <span className="relative flex size-8 shrink-0">
      {members.slice(0, 2).map((m, i) => (
        <span className={cn("absolute", i === 0 ? "top-0 left-0" : "right-0 bottom-0")} key={m.id}>
          <BotAvatar color={m.color} emoji={m.emoji} size="xs" />
        </span>
      ))}
    </span>
  );
}

function Row({
  href,
  active,
  avatar,
  name,
  preview,
  time,
  unread,
  attention,
  working,
  menu,
  onNavigate,
}: {
  readonly href: string;
  readonly active: boolean;
  readonly avatar: ReactNode;
  readonly name: string;
  readonly preview?: string;
  readonly time?: string;
  readonly unread: boolean;
  readonly attention: boolean;
  readonly working: boolean;
  readonly menu: ReactNode;
  readonly onNavigate?: () => void;
}) {
  return (
    <li className="group relative">
      <Link
        className={cn("flex items-center gap-2.5 rounded-xl px-2 py-1.5 pr-8 transition-colors", active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]")}
        href={href}
        onClick={onNavigate}
      >
        {avatar}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn("truncate text-[13px]", unread || attention ? "font-medium text-white" : "text-neutral-200")}>{name}</span>
            {time ? <span className="ml-auto shrink-0 text-[10.5px] text-neutral-600 group-hover:opacity-0">{time}</span> : null}
          </span>
          <span
            className={cn(
              "block truncate text-[11.5px]",
              working ? "text-emerald-400/90" : attention ? "text-amber-300/90" : unread ? "text-neutral-300" : "text-neutral-500",
            )}
          >
            {working ? "typing…" : attention ? "Needs attention" : (preview ?? "")}
          </span>
        </span>
        {attention ? (
          <span className="absolute top-1/2 right-2.5 size-2 -translate-y-1/2 rounded-full bg-amber-400 group-hover:opacity-0" />
        ) : unread ? (
          <span className="absolute top-1/2 right-2.5 size-2 -translate-y-1/2 rounded-full bg-sky-400 group-hover:opacity-0" />
        ) : null}
      </Link>
      <div className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100">{menu}</div>
    </li>
  );
}

function FooterLink({
  href,
  icon: Icon,
  label,
  active,
  onNavigate,
}: {
  readonly href: string;
  readonly icon: ComponentType<{ className?: string }>;
  readonly label: string;
  readonly active: boolean;
  readonly onNavigate?: () => void;
}) {
  return (
    <Link
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-colors",
        active ? "bg-white/[0.08] text-white" : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100",
      )}
      href={href}
      onClick={onNavigate}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

function SidebarContent({ onNavigate, onNew, onSearch }: { readonly onNavigate?: () => void; readonly onNew: () => void; readonly onSearch: () => void }) {
  const { state } = useAppState();
  const pathname = usePathname();
  const [showHidden, setShowHidden] = useState(false);
  const visibleBots = state.bots.filter((b) => !b.hidden);
  const hiddenBots = state.bots.filter((b) => b.hidden);
  const groups = state.groups.filter((g) => !g.hidden);
  const pinnedBots = visibleBots.filter((b) => b.pinned).sort(byActivity);
  const pinnedGroups = groups.filter((g) => g.pinned).sort(byActivity);
  const bots = visibleBots.filter((b) => !b.pinned).sort(byActivity);
  const otherGroups = groups.filter((g) => !g.pinned).sort(byActivity);

  const botRow = (bot: Bot) => (
    <Row
      active={pathname.startsWith(`/app/bots/${bot.id}`)}
      attention={bot.status === "attention"}
      avatar={<BotAvatar color={bot.color} emoji={bot.emoji} name={bot.name} size="sm" status={bot.status === "idle" ? undefined : bot.status} />}
      href={`/app/bots/${bot.id}`}
      key={bot.id}
      menu={<BotMenu bot={bot} />}
      name={bot.name}
      onNavigate={onNavigate}
      preview={bot.lastPreview ?? bot.label}
      time={bot.lastMessageAt ? timeAgo(bot.lastMessageAt) : undefined}
      unread={bot.unread}
      working={bot.status === "working" && !bot.statusText?.startsWith("In ")}
    />
  );
  const groupRow = (group: Group) => (
    <Row
      active={pathname.startsWith(`/app/groups/${group.id}`)}
      attention={false}
      avatar={<GroupAvatar bots={state.bots} group={group} />}
      href={`/app/groups/${group.id}`}
      key={group.id}
      menu={<GroupMenu group={group} />}
      name={group.name}
      onNavigate={onNavigate}
      preview={group.lastPreview ?? `${group.memberBotIds.length} Bots`}
      time={group.lastMessageAt ? timeAgo(group.lastMessageAt) : undefined}
      unread={group.unread}
      working={group.working.length > 0}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/app" onClick={onNavigate}>
          <BezLogo className="text-[14px]" />
        </Link>
        <div className="flex items-center gap-1">
          <button
            aria-label="Search (⌘K)"
            className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/[0.06] hover:text-white"
            onClick={onSearch}
            type="button"
          >
            <SearchIcon className="size-4" />
          </button>
          <button
            aria-label="New (⌘N)"
            className="flex h-7 items-center gap-1.5 rounded-lg border border-white/10 px-2 text-[12.5px] text-neutral-300 hover:border-white/25 hover:text-white"
            onClick={onNew}
            type="button"
          >
            <SquarePenIcon className="size-3.5" /> New
          </button>
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {pinnedBots.length + pinnedGroups.length > 0 ? (
          <>
            <div className="px-2 pt-1 pb-1 text-[11px] font-medium tracking-wide text-neutral-500 uppercase">Pinned</div>
            <ul className="space-y-0.5">
              {pinnedBots.map(botRow)}
              {pinnedGroups.map(groupRow)}
            </ul>
          </>
        ) : null}
        <div className="px-2 pt-3 pb-1 text-[11px] font-medium tracking-wide text-neutral-500 uppercase">Bots</div>
        <ul className="space-y-0.5">
          {bots.map(botRow)}
          {visibleBots.length === 0 ? (
            <li>
              <button className="px-2 py-1.5 text-[12.5px] text-neutral-500 hover:text-white" onClick={onNew} type="button">
                Create your first Bot →
              </button>
            </li>
          ) : null}
        </ul>
        {otherGroups.length > 0 ? (
          <>
            <div className="px-2 pt-4 pb-1 text-[11px] font-medium tracking-wide text-neutral-500 uppercase">Group chats</div>
            <ul className="space-y-0.5">{otherGroups.map(groupRow)}</ul>
          </>
        ) : null}
        {hiddenBots.length > 0 ? (
          <div className="pt-4">
            <button
              className="flex items-center gap-1 px-2 text-[11px] font-medium tracking-wide text-neutral-600 uppercase hover:text-neutral-300"
              onClick={() => setShowHidden((v) => !v)}
              type="button"
            >
              {showHidden ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
              {visibleBots.length === 0 ? "Show Hidden Bots" : `Hidden Bots (${hiddenBots.length})`}
            </button>
            {showHidden ? <ul className="mt-1 space-y-0.5 opacity-70">{hiddenBots.map(botRow)}</ul> : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-0.5 border-t border-white/[0.06] p-2">
        <FooterLink active={pathname.startsWith("/app/marketplace")} href="/app/marketplace" icon={StoreIcon} label="Marketplace" onNavigate={onNavigate} />
        <FooterLink active={pathname.startsWith("/app/skills")} href="/app/skills" icon={BookOpenIcon} label="Skills" onNavigate={onNavigate} />
        <FooterLink active={pathname.startsWith("/app/settings")} href="/app/settings" icon={SettingsIcon} label="Settings" onNavigate={onNavigate} />
        <button
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"
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

function CommandPalette({ open, onOpenChange, onNew }: { readonly open: boolean; readonly onOpenChange: (open: boolean) => void; readonly onNew: () => void }) {
  const router = useRouter();
  const { state } = useAppState();
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const item = "gap-2.5 rounded-lg text-[13px] data-[selected=true]:bg-white/[0.07] data-[selected=true]:text-white";
  return (
    <CommandDialog className="max-w-lg rounded-2xl border-white/10 bg-[#0c0c0e] text-white" onOpenChange={onOpenChange} open={open} showCloseButton={false}>
      <CommandInput placeholder="Switch Bots and groups, or jump to a page…" />
      <CommandList className="scrollbar-thin">
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Bots">
          {state.bots.map((b) => (
            <CommandItem className={item} key={b.id} onSelect={() => go(`/app/bots/${b.id}`)} value={`bot ${b.name} ${b.label}`}>
              <BotAvatar color={b.color} emoji={b.emoji} size="xs" /> {b.name}
              {b.hidden ? <span className="text-[11px] text-neutral-600">hidden</span> : null}
            </CommandItem>
          ))}
        </CommandGroup>
        {state.groups.length > 0 ? (
          <CommandGroup heading="Group chats">
            {state.groups.map((g) => (
              <CommandItem className={item} key={g.id} onSelect={() => go(`/app/groups/${g.id}`)} value={`group ${g.name}`}>
                {g.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        <CommandGroup heading="Go to">
          <CommandItem className={item} onSelect={() => { onOpenChange(false); onNew(); }} value="new bot group chat">
            New Bot or group chat
          </CommandItem>
          <CommandItem className={item} onSelect={() => go("/app/skills")} value="skills library">
            Skills
          </CommandItem>
          <CommandItem className={item} onSelect={() => go("/app/marketplace")} value="marketplace templates">
            Marketplace
          </CommandItem>
          <CommandItem className={item} onSelect={() => go("/app/settings")} value="settings auto review computer logins timezone">
            Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useAppState();
  const [open, setOpen] = useState(false);
  const [newChat, setNewChat] = useState(false);
  const [palette, setPalette] = useState(false);

  // ⌘N new chat, ⌘K search, ⌘1–9 jump to a Bot, Alt+↑/↓ previous or next Bot.
  useEffect(() => {
    const order = state.bots.filter((b) => !b.hidden).sort((a, b) => Number(b.pinned) - Number(a.pinned) || byActivity(a, b));
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setNewChat(true);
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      } else if (mod && /^[1-9]$/.test(e.key)) {
        const bot = order[Number(e.key) - 1];
        if (bot) {
          e.preventDefault();
          router.push(`/app/bots/${bot.id}`);
        }
      } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        const index = order.findIndex((b) => pathname.startsWith(`/app/bots/${b.id}`));
        const next = order[(index + (e.key === "ArrowDown" ? 1 : order.length - 1) + order.length) % order.length];
        if (next) {
          e.preventDefault();
          router.push(`/app/bots/${next.id}`);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.bots, pathname, router]);

  const content = (onNavigate?: () => void) => (
    <SidebarContent onNavigate={onNavigate} onNew={() => setNewChat(true)} onSearch={() => setPalette(true)} />
  );

  return (
    <>
      <aside className="hidden w-72 shrink-0 border-r border-white/[0.06] bg-[#050505] md:block">{content()}</aside>
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
          <aside className="absolute inset-y-0 left-0 w-80 max-w-[85vw] border-r border-white/10 bg-[#050505]">{content(() => setOpen(false))}</aside>
        </div>
      ) : null}
      <NewChatDialog onOpenChange={setNewChat} open={newChat} />
      <CommandPalette onNew={() => setNewChat(true)} onOpenChange={setPalette} open={palette} />
    </>
  );
}
