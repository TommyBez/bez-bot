"use client";

import { CopyIcon, EyeIcon, EyeOffIcon, MailIcon, MoreHorizontalIcon, PencilIcon, PinIcon, PinOffIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAppState } from "@/components/app/app-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Bot, Group } from "@shared/store/types";

const content = "min-w-52 rounded-xl border-white/10 bg-[#141416] p-1 text-neutral-200";
const item = "gap-2 rounded-lg px-2.5 py-1.5 text-[13px] focus:bg-white/[0.07] focus:text-white [&_svg]:size-3.5 [&_svg]:text-neutral-400";

function Trigger({ className, children }: { readonly className?: string; readonly children?: ReactNode }) {
  return (
    <DropdownMenuTrigger asChild>
      {children ?? (
        <button
          aria-label="More"
          className={cn("flex size-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/[0.08] hover:text-white", className)}
          onClick={(e) => e.stopPropagation()}
          type="button"
        >
          <MoreHorizontalIcon className="size-4" />
        </button>
      )}
    </DropdownMenuTrigger>
  );
}

export function BotMenu({
  bot,
  onEditProfile,
  className,
  children,
}: {
  readonly bot: Bot;
  readonly onEditProfile?: () => void;
  readonly className?: string;
  readonly children?: ReactNode;
}) {
  const router = useRouter();
  const { refresh } = useAppState();
  const patch = async (json: Record<string, unknown>) => {
    await api(`/api/bots/${bot.id}`, { method: "PATCH", json });
    await refresh();
  };
  return (
    <DropdownMenu>
      <Trigger className={className}>{children}</Trigger>
      <DropdownMenuContent align="end" className={content}>
        <DropdownMenuItem className={item} onSelect={() => (onEditProfile ? onEditProfile() : router.push(`/app/bots/${bot.id}?details=settings`))}>
          <PencilIcon /> Edit profile
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => void patch({ pinned: !bot.pinned })}>
          {bot.pinned ? <PinOffIcon /> : <PinIcon />} {bot.pinned ? "Unpin" : "Pin"}
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => void patch({ unread: !bot.unread })}>
          <MailIcon /> {bot.unread ? "Mark as read" : "Mark as unread"}
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => void navigator.clipboard.writeText(bot.sessionId ?? bot.id)}>
          <CopyIcon /> Copy conversation ID
        </DropdownMenuItem>
        <DropdownMenuItem
          className={item}
          onSelect={async () => {
            const { bot: copy } = await api<{ bot: Bot }>(`/api/bots/${bot.id}/duplicate`, { method: "POST" });
            await refresh();
            router.push(`/app/bots/${copy.id}`);
          }}
        >
          <UsersIcon /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => void patch({ hidden: !bot.hidden })}>
          {bot.hidden ? <EyeIcon /> : <EyeOffIcon />} {bot.hidden ? "Show in sidebar" : "Hide from sidebar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          className={cn(item, "text-red-300 focus:text-red-200 [&_svg]:text-red-300")}
          onSelect={async () => {
            if (!window.confirm(`Delete ${bot.name}? Its conversation and routines are removed. Files and sign-ins on the computer stay.`)) return;
            await api(`/api/bots/${bot.id}`, { method: "DELETE" });
            await refresh();
            router.push("/app");
          }}
        >
          <Trash2Icon /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GroupMenu({ group, className }: { readonly group: Group; readonly className?: string }) {
  const router = useRouter();
  const { refresh } = useAppState();
  const patch = async (json: Record<string, unknown>) => {
    await api(`/api/groups/${group.id}`, { method: "PATCH", json });
    await refresh();
  };
  return (
    <DropdownMenu>
      <Trigger className={className} />
      <DropdownMenuContent align="end" className={content}>
        <DropdownMenuItem
          className={item}
          onSelect={() => {
            const name = window.prompt("Rename chat", group.name)?.trim();
            if (name) void patch({ name });
          }}
        >
          <PencilIcon /> Rename chat
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => void patch({ pinned: !group.pinned })}>
          {group.pinned ? <PinOffIcon /> : <PinIcon />} {group.pinned ? "Unpin" : "Pin"}
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => void patch({ unread: !group.unread })}>
          <MailIcon /> {group.unread ? "Mark as read" : "Mark as unread"}
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => void patch({ hidden: !group.hidden })}>
          {group.hidden ? <EyeIcon /> : <EyeOffIcon />} {group.hidden ? "Show in sidebar" : "Hide from sidebar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          className={cn(item, "text-red-300 focus:text-red-200 [&_svg]:text-red-300")}
          onSelect={async () => {
            if (!window.confirm(`Delete “${group.name}”? The Bots stay; only this group chat is removed.`)) return;
            await api(`/api/groups/${group.id}`, { method: "DELETE" });
            await refresh();
            router.push("/app");
          }}
        >
          <Trash2Icon /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
