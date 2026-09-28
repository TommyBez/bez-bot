"use client";

import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppState } from "@/components/app/app-state";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Group } from "@shared/store/types";

const field = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-neutral-600 focus:border-white/30";

export function GroupDetails({ group, onClose }: { readonly group: Group; readonly onClose: () => void }) {
  const { state, refresh } = useAppState();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [members, setMembers] = useState(group.memberBotIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setName(group.name);
    setDescription(group.description);
    setMembers(group.memberBotIds);
  }, [group.id, group.name, group.description, group.memberBotIds]);

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      await api(`/api/groups/${group.id}`, { method: "PATCH", json: { name, description, memberBotIds: members } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <span className="text-[13.5px] text-white">Group settings</span>
        <button aria-label="Close" className="text-neutral-500 hover:text-white" onClick={onClose} type="button">
          <XIcon className="size-4" />
        </button>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <label className="block space-y-1.5">
          <span className="text-[12px] text-neutral-400">Group name</span>
          <input className={field} onChange={(e) => setName(e.target.value)} value={name} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[12px] text-neutral-400">Description</span>
          <textarea
            className={cn(field, "min-h-28 resize-y")}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="The shared outcome and who owns what. Every Bot in the group reads this when it replies."
            value={description}
          />
        </label>
        <div className="space-y-1.5">
          <span className="text-[12px] text-neutral-400">Members (2–6)</span>
          <ul className="space-y-1">
            {state.bots.map((b) => {
              const on = members.includes(b.id);
              return (
                <li key={b.id}>
                  <button
                    className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.04] disabled:opacity-40"
                    disabled={(!on && members.length >= 6) || (on && members.length <= 2)}
                    onClick={() => setMembers((m) => (on ? m.filter((id) => id !== b.id) : [...m, b.id]))}
                    type="button"
                  >
                    <BotAvatar color={b.color} emoji={b.emoji} size="xs" />
                    <span className="flex-1 text-[13px] text-neutral-200">{b.name}</span>
                    <span className={cn("flex size-4.5 items-center justify-center rounded border", on ? "border-white bg-white text-black" : "border-white/20")}>
                      {on ? <CheckIcon className="size-3" /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <button
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-4 text-[12.5px] font-medium text-black disabled:opacity-50"
          disabled={saving}
          onClick={() => void save()}
          type="button"
        >
          {saving ? <Loader2Icon className="size-3.5 animate-spin" /> : null} Save
        </button>
        {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
