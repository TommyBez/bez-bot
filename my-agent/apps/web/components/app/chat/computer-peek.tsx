"use client";

import { FileIcon, GlobeIcon, GraduationCapIcon, KeyRoundIcon, MonitorIcon, TerminalIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BotAvatar, StatusDot } from "@/components/bez/bot-avatar";
import { timeAgo, usePoll } from "@/lib/client";
import { useAppState } from "@/components/app/app-state";
import type { ComputerActivity, ComputerState } from "@shared/store/types";

export interface ComputerResponse {
  computer: ComputerState;
  desktop: boolean;
}

const ICONS = { command: TerminalIcon, file: FileIcon, browser: GlobeIcon, screen: MonitorIcon, credential: KeyRoundIcon } as const;

export function ActivityList({ items, limit = 30 }: { readonly items: ComputerActivity[]; readonly limit?: number }) {
  const { state } = useAppState();
  if (items.length === 0) return <p className="text-[12.5px] text-neutral-500">Nothing yet. Commands, files, and browsing show up here as they happen.</p>;
  return (
    <ul className="space-y-2">
      {items.slice(0, limit).map((a) => {
        const Icon = ICONS[a.kind] ?? TerminalIcon;
        const bot = state.bots.find((b) => b.id === a.botId);
        return (
          <li className="flex items-start gap-2.5" key={a.id}>
            {bot ? <BotAvatar color={bot.color} emoji={bot.emoji} size="xs" /> : <Icon className="mt-0.5 size-3.5 text-neutral-500" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] text-neutral-300">{a.summary}</span>
              <span className="block text-[11px] text-neutral-600">
                {bot?.name ?? "A bot"} · {timeAgo(a.at)}
                {a.detail ? ` · ${a.detail}` : ""}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Screen({ at, desktop }: { readonly at?: string | null; readonly desktop: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!at) return;
    setSrc(`/api/computer/screenshot?t=${encodeURIComponent(at)}`);
  }, [at]);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0d0f]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="The bots' desktop" className="aspect-video w-full object-cover" src={src} />
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 p-4 text-center">
          <MonitorIcon className="size-6 text-neutral-600" />
          <p className="text-[12px] text-neutral-500">
            {desktop
              ? "The desktop appears here after a bot uses the browser."
              : "Desktop control runs on Vercel Sandbox. Locally, bots use the terminal and files."}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The Agent Computer view for one Bot: its screen on the shared computer, the
 * shared drive, and what it has been doing. "Teach a task" lives here.
 */
export function ComputerPeek({
  botId,
  onClose,
  onTeach,
}: {
  readonly botId?: string;
  readonly onClose?: () => void;
  readonly onTeach?: () => void;
}) {
  const { data } = usePoll<ComputerResponse>("/api/computer", 4000);
  const computer = data?.computer;
  const activity = (computer?.activity ?? []).filter((a) => !botId || a.botId === botId);
  const working = activity[0] && Date.now() - new Date(activity[0].at).getTime() < 60_000;
  return (
    <div className="scrollbar-thin flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] text-white">
          <MonitorIcon className="size-4" /> Agent Computer
        </span>
        <div className="flex items-center gap-3">
          {onTeach ? (
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11.5px] text-neutral-300 hover:border-white/25 hover:text-white"
              onClick={onTeach}
              type="button"
            >
              <GraduationCapIcon className="size-3.5" /> Teach a task
            </button>
          ) : null}
          <span className="flex items-center gap-1.5 text-[11.5px] text-neutral-400">
            <StatusDot className="size-2 ring-0" status={working ? "working" : "idle"} />
            {working ? "Working" : "Idle"}
          </span>
          {onClose ? (
            <button aria-label="Close" className="text-neutral-500 hover:text-white" onClick={onClose} type="button">
              <XIcon className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
      <Screen at={computer?.lastScreenshotAt} desktop={data?.desktop ?? false} />
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] text-neutral-500">Shared drive · {computer?.files.length ?? 0} files</span>
          <Link className="text-[12px] text-neutral-500 hover:text-white" href="/app/settings#computer">
            Manage
          </Link>
        </div>
        <ul className="space-y-1">
          {(computer?.files ?? []).slice(0, 8).map((f) => (
            <li key={f.path}>
              <a className="block truncate font-mono text-[11.5px] text-neutral-400 hover:text-white" href={`/api/computer/file?path=${encodeURIComponent(f.path)}`} rel="noreferrer" target="_blank">
                {f.path}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="mb-2 text-[12px] text-neutral-500">Activity</div>
        <ActivityList items={activity} limit={12} />
      </div>
    </div>
  );
}
