"use client";

import { CheckIcon, CircleIcon, MonitorIcon, MousePointer2Icon, PlayIcon, SparklesIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { BotAvatar, StatusDot } from "@/components/bez/bot-avatar";
import { cn } from "@/lib/utils";

export function AppWindow({
  title,
  children,
  className,
  right,
}: {
  readonly title?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly right?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[20px] border border-white/10 bg-[#0a0a0b] shadow-[0_40px_120px_-40px_rgba(255,255,255,0.12)]",
        className,
      )}
    >
      <div className="flex h-10 items-center gap-2 border-b border-white/[0.06] px-4">
        <span className="size-3 rounded-full bg-[#ff5f57]/80" />
        <span className="size-3 rounded-full bg-[#febc2e]/80" />
        <span className="size-3 rounded-full bg-[#28c840]/80" />
        {title ? <span className="ml-3 text-[12px] text-neutral-500">{title}</span> : null}
        <span className="ml-auto">{right}</span>
      </div>
      {children}
    </div>
  );
}

const HERO_BOTS = [
  { name: "Sales Outbound", emoji: "📈", color: "#3b82f6", status: "working" as const, note: "Drafting 14 emails" },
  { name: "Chief of Staff", emoji: "🧠", color: "#eab308", status: "waiting" as const, note: "Needs your approval" },
  { name: "Research", emoji: "🔬", color: "#14b8a6", status: "working" as const, note: "Comparing 6 sources" },
  { name: "Bug Reproduction", emoji: "🐞", color: "#ef4444", status: "idle" as const, note: "Filed BUG-2231" },
  { name: "Account Health", emoji: "❤️‍🩹", color: "#ec4899", status: "idle" as const, note: "3 accounts at risk" },
];

export function HeroAppMock() {
  return (
    <AppWindow className="mx-auto w-full max-w-6xl" title="Bez Bot">
      <div className="grid min-h-[480px] grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_300px]">
        <aside className="hidden border-r border-white/[0.06] p-3 md:block">
          <div className="mb-3 px-2 text-[11px] font-medium tracking-wide text-neutral-500 uppercase">Bots</div>
          <ul className="space-y-0.5">
            {HERO_BOTS.map((bot, i) => (
              <li
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2 py-2",
                  i === 1 ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
                )}
                key={bot.name}
              >
                <BotAvatar color={bot.color} emoji={bot.emoji} size="sm" status={bot.status} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-neutral-200">{bot.name}</span>
                  <span className="block truncate text-[11.5px] text-neutral-500">{bot.note}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 mb-2 px-2 text-[11px] font-medium tracking-wide text-neutral-500 uppercase">Threads</div>
          <ul className="space-y-0.5 text-[13px] text-neutral-400">
            <li className="rounded-xl px-2 py-1.5"># q3-launch</li>
            <li className="rounded-xl px-2 py-1.5"># weekly-brief</li>
          </ul>
        </aside>
        <section className="flex flex-col">
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3">
            <BotAvatar color="#eab308" emoji="🧠" size="sm" />
            <div>
              <div className="text-[13.5px] text-white">Chief of Staff</div>
              <div className="text-[11.5px] text-neutral-500">Runs the team&apos;s operating rhythm</div>
            </div>
          </div>
          <div className="flex-1 space-y-4 px-5 py-5 text-[13.5px]">
            <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-2.5 text-neutral-100">
              Get an update from every bot and write my weekly brief.
            </div>
            <div className="flex flex-wrap gap-2">
              {["Asking Sales Outbound", "Asking Research", "Asking Account Health"].map((label) => (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[12px] text-neutral-400" key={label}>
                  <CheckIcon className="size-3 text-emerald-400" />
                  {label}
                </span>
              ))}
            </div>
            <div className="max-w-[88%] space-y-2 text-neutral-200">
              <p>Brief is ready: <span className="font-mono text-[12.5px] text-neutral-400">/workspace/shared/briefs/2026-09-28.md</span></p>
              <ul className="list-disc space-y-1 pl-5 text-neutral-300">
                <li>Pipeline: 38 new qualified contacts, 6 replies (Sales Outbound)</li>
                <li>Risk: Acme usage down 22% week over week (Account Health)</li>
                <li>Decision needed: approve the renewal discount for Acme</li>
              </ul>
            </div>
            <div className="max-w-[88%] rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-3">
              <div className="mb-2 text-[12.5px] text-amber-200">Approval needed · Send renewal offer to Acme</div>
              <div className="flex gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-black">Approve</span>
                <span className="rounded-full border border-white/15 px-3 py-1 text-[12px] text-neutral-300">Deny</span>
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.06] p-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] text-neutral-500">Message Chief of Staff…</div>
          </div>
        </section>
        <aside className="hidden border-l border-white/[0.06] p-4 lg:block">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12.5px] text-neutral-300">
              <MonitorIcon className="size-3.5" /> Computer
            </span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-emerald-400">
              <StatusDot status="working" /> Working
            </span>
          </div>
          <ComputerScreen compact />
          <div className="mt-4 space-y-2 text-[12px] text-neutral-500">
            {["Opened crm.acme.io", "Exported pipeline.csv", "Wrote briefs/2026-09-28.md"].map((a) => (
              <div className="flex items-center gap-2" key={a}>
                <CircleIcon className="size-2 fill-neutral-600 text-neutral-600" /> {a}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </AppWindow>
  );
}

function ComputerScreen({ compact = false }: { readonly compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#111]">
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-[#161616] px-2 py-1.5">
        <span className="size-1.5 rounded-full bg-neutral-600" />
        <span className="size-1.5 rounded-full bg-neutral-600" />
        <span className="ml-2 flex-1 truncate rounded-md bg-[#0c0c0c] px-2 py-0.5 text-[10px] text-neutral-500">
          https://support.zendesk.com/agent/filters
        </span>
      </div>
      <div className={cn("space-y-1.5 p-2.5", compact ? "h-36" : "h-56")}>
        {Array.from({ length: compact ? 5 : 8 }).map((_, i) => (
          <div className="flex items-center gap-2" key={i}>
            <span className="size-2 rounded-sm bg-neutral-700" />
            <span className="h-2 rounded bg-neutral-800" style={{ width: `${40 + ((i * 37) % 50)}%` }} />
            <span className="ml-auto h-2 w-8 rounded bg-neutral-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MessageMock() {
  return (
    <AppWindow title="Sales Outbound">
      <div className="space-y-4 p-5 text-[13.5px]">
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-2.5 text-neutral-100">
          Build a list of 20 Series B fintechs hiring RevOps and draft first-touch emails.
        </div>
        <div className="flex items-start gap-3">
          <BotAvatar color="#3b82f6" emoji="📈" size="sm" />
          <div className="space-y-2 text-neutral-200">
            <p>Done. 20 accounts, 31 contacts scored by intent. Drafts are in your voice and waiting for review.</p>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12.5px] text-neutral-400">
              <div className="mb-1 font-mono text-neutral-300">outbound/2026-09-28.md</div>
              Ramp · Mercury · Brex · Pilot · … 16 more
            </div>
            <p className="text-neutral-400">Want me to send the 12 highest-intent ones? I&apos;ll need your approval.</p>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

const MANY = [
  { name: "Project", emoji: "🗂️", color: "#a855f7", task: "Updating the launch plan", status: "working" as const },
  { name: "Outbound", emoji: "📈", color: "#3b82f6", task: "Researching 40 accounts", status: "working" as const },
  { name: "Systems", emoji: "🛠️", color: "#22c55e", task: "Reconciling Stripe payouts", status: "working" as const },
  { name: "Research", emoji: "🔬", color: "#14b8a6", task: "Waiting on your answer", status: "waiting" as const },
];

export function ManyBotsMock() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {MANY.map((bot) => (
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0b] p-4" key={bot.name}>
          <div className="mb-6 flex items-center justify-between">
            <BotAvatar color={bot.color} emoji={bot.emoji} size="md" />
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]",
                bot.status === "working" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300",
              )}
            >
              <StatusDot className="size-1.5 ring-0" status={bot.status} />
              {bot.status === "working" ? "Working" : "Needs you"}
            </span>
          </div>
          <div className="text-[14px] text-white">{bot.name}</div>
          <div className="text-[12.5px] text-neutral-500">{bot.task}</div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full animate-shimmer rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] bg-[length:200%_100%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ComputerMock() {
  const [inControl, setInControl] = useState(true);
  useEffect(() => {
    const id = window.setInterval(() => setInControl((v) => !v), 3200);
    return () => window.clearInterval(id);
  }, []);
  return (
    <AppWindow
      right={
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] transition-colors",
            inControl ? "bg-sky-400/10 text-sky-300" : "bg-emerald-400/10 text-emerald-300",
          )}
        >
          {inControl ? <MousePointer2Icon className="size-3" /> : <StatusDot className="size-1.5 ring-0" status="working" />}
          {inControl ? "You're in control" : "Working"}
        </span>
      }
      title="Computer"
    >
      <div className="space-y-4 p-5">
        <ComputerScreen />
        <div className="flex items-start gap-3 text-[13.5px]">
          <BotAvatar color="#6366f1" emoji="🎧" size="sm" />
          <p className="text-neutral-200">Sign in to Zendesk so I can work the support queue.</p>
        </div>
        <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-2 text-[13px] text-neutral-100">
          Done, you&apos;re signed in.
          <span className="mt-0.5 block text-right text-[11px] text-neutral-500">You</span>
        </div>
      </div>
    </AppWindow>
  );
}

export function TeachMock() {
  const [seconds, setSeconds] = useState(4);
  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => (s >= 59 ? 0 : s + 1)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <AppWindow title="Teach a task">
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-3">
            <BotAvatar color="#06b6d4" emoji="📊" size="sm" />
            <div>
              <div className="text-[13.5px] text-white">Weekly Reporting</div>
              <div className="shimmer-text text-[12px]">is watching and learning</div>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[12.5px] text-red-300">
            <span className="size-2 animate-pulse-dot rounded-full bg-red-500" />
            0:{String(seconds).padStart(2, "0")}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["Open Looker", "Filter: last 7 days", "Export CSV"].map((step, i) => (
            <div className="rounded-xl border border-white/10 bg-[#0d0d0f] p-2.5 text-[11.5px] text-neutral-400" key={step}>
              <div className="mb-1 font-mono text-neutral-600">step {i + 1}</div>
              {step}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-neutral-500">You</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-black">
            <PlayIcon className="size-3 fill-black" /> Teach a task
          </span>
        </div>
      </div>
    </AppWindow>
  );
}

export function MemoryMock() {
  return (
    <AppWindow title="Account Manager">
      <div className="space-y-4 p-5 text-[13.5px]">
        <div className="flex items-start gap-3">
          <BotAvatar color="#ec4899" emoji="🤝" size="sm" />
          <div className="space-y-3 text-neutral-200">
            <p>
              Acme replied on pricing, same thread as last quarter. I already had the context, so I answered without waiting on you.
            </p>
            <p className="text-neutral-400">Noted for next time: they only sign annual, and Dana is the one who approves.</p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] text-neutral-300">
              <SparklesIcon className="size-3 text-fuchsia-300" />
              Updated memory for <span className="text-white">Account Manager</span>
            </span>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

const CONNECT = [
  { label: "Asking Research", emoji: "🔬", color: "#14b8a6" },
  { label: "Looping in Comms", emoji: "✍️", color: "#f43f5e" },
  { label: "Sending to Chief", emoji: "🧠", color: "#eab308" },
  { label: "Pinging Travel", emoji: "✈️", color: "#0ea5e9" },
];

export function ConnectMock() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setActive((a) => (a + 1) % (CONNECT.length + 1)), 1100);
    return () => window.clearInterval(id);
  }, []);
  return (
    <AppWindow title="# q3-offsite">
      <div className="space-y-3 p-5">
        <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-2.5 text-[13.5px] text-neutral-100">
          Plan the Q3 offsite: agenda, announcement, and travel for 12 people.
        </div>
        {CONNECT.map((item, i) => (
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all duration-500",
              i < active ? "border-white/10 bg-white/[0.03] opacity-100" : i === active ? "border-white/20 bg-white/[0.05] opacity-100" : "border-transparent opacity-30",
            )}
            key={item.label}
          >
            <BotAvatar color={item.color} emoji={item.emoji} size="sm" />
            <span className="text-[13px] text-neutral-200">{item.label}</span>
            <span className="ml-auto">
              {i < active ? (
                <CheckIcon className="size-4 text-emerald-400" />
              ) : (
                <span className="typing-dots flex gap-0.5 text-neutral-400">
                  <span>•</span>
                  <span>•</span>
                  <span>•</span>
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </AppWindow>
  );
}
