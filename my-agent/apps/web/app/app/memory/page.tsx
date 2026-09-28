"use client";

import { PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { useState } from "react";
import { useAppState } from "@/components/app/app-state";
import { AppHeader, AppPage, buttonPrimary, Card, inputClass } from "@/components/app/page-header";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api, timeAgo, usePoll } from "@/lib/client";
import type { MemoryDoc, MemoryEntry } from "@shared/store/types";

interface MemoryResponse {
  team: MemoryDoc;
  bots: { botId: string; name: string; emoji: string; color: string; memory: MemoryDoc }[];
}

function Entry({ entry, scope, onChange }: { readonly entry: MemoryEntry; readonly scope: string; readonly onChange: () => void }) {
  const { state } = useAppState();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.text);
  const author = state.bots.find((b) => b.id === entry.authorBotId);
  return (
    <li className="group flex items-start gap-3 py-2.5">
      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-600" />
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await api("/api/memory", { method: "PATCH", json: { scope, id: entry.id, text } });
              setEditing(false);
              onChange();
            }}
          >
            <input autoFocus className={inputClass} onChange={(e) => setText(e.target.value)} value={text} />
            <button className={buttonPrimary} type="submit">
              Save
            </button>
          </form>
        ) : (
          <p className="text-[13.5px] text-neutral-200">{entry.text}</p>
        )}
        <p className="mt-0.5 text-[11.5px] text-neutral-600">
          {entry.source === "user" ? "Added by you" : `Learned by ${author?.name ?? "a bot"}`}
          {entry.source === "teammate" ? " while helping a teammate" : ""} · {timeAgo(entry.createdAt)}
        </p>
      </div>
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button aria-label="Edit" className="rounded-lg p-1.5 text-neutral-500 hover:text-white" onClick={() => setEditing(true)} type="button">
          <PencilIcon className="size-3.5" />
        </button>
        <button
          aria-label="Delete"
          className="rounded-lg p-1.5 text-neutral-500 hover:text-red-300"
          onClick={async () => {
            await api("/api/memory", { method: "DELETE", json: { scope, id: entry.id } });
            onChange();
          }}
          type="button"
        >
          <Trash2Icon className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

function MemorySection({
  scope,
  title,
  icon,
  doc,
  onChange,
}: {
  readonly scope: string;
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly doc: MemoryDoc;
  readonly onChange: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-3">
        {icon}
        <div className="flex-1">
          <div className="text-[14.5px] text-white">{title}</div>
          <div className="text-[12px] text-neutral-500">{doc.entries.length} things remembered</div>
        </div>
      </div>
      {doc.entries.length > 0 ? (
        <ul className="divide-y divide-white/[0.05]">
          {[...doc.entries].reverse().map((e) => (
            <Entry entry={e} key={e.id} onChange={onChange} scope={scope} />
          ))}
        </ul>
      ) : (
        <p className="py-3 text-[13px] text-neutral-500">Nothing yet. Bots save what they learn here as they work.</p>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          await api("/api/memory", { method: "POST", json: { scope, text } });
          setText("");
          onChange();
        }}
      >
        <input className={inputClass} onChange={(e) => setText(e.target.value)} placeholder="Add something it should always know…" value={text} />
        <button aria-label="Add memory" className={buttonPrimary} type="submit">
          <PlusIcon className="size-4" />
        </button>
      </form>
    </Card>
  );
}

export default function MemoryPage() {
  const { data, refresh } = usePoll<MemoryResponse>("/api/memory", 6000);
  return (
    <AppPage>
      <AppHeader
        body="Bots keep context and learn from each other. Memory is data they read before every task, never instructions."
        title="Memory"
      />
      {data ? (
        <div className="space-y-4">
          <MemorySection
            doc={data.team}
            icon={
              <span className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <UsersIcon className="size-4 text-neutral-300" />
              </span>
            }
            onChange={() => void refresh()}
            scope="team"
            title="Team memory · shared by every bot"
          />
          {data.bots.map((b) => (
            <MemorySection
              doc={b.memory}
              icon={<BotAvatar color={b.color} emoji={b.emoji} size="md" />}
              key={b.botId}
              onChange={() => void refresh()}
              scope={b.botId}
              title={b.name}
            />
          ))}
        </div>
      ) : (
        <p className="shimmer-text text-[14px]">Loading memory…</p>
      )}
    </AppPage>
  );
}
