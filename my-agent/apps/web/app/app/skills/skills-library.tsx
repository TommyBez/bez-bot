"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { useAppState } from "@/components/app/app-state";
import { EmptyState } from "@/components/app/page-header";
import { api, timeAgo, usePoll } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Skill } from "@shared/store/types";

function SkillEditor({ skill, onChanged }: { readonly skill: Skill; readonly onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(skill.body);
  const [description, setDescription] = useState(skill.description);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setBody(skill.body);
    setDescription(skill.description);
  }, [skill.id, skill.body, skill.description]);

  async function save(patch: Partial<Skill>) {
    setSaving(true);
    try {
      await api(`/api/skills/${skill.id}`, { method: "PATCH", json: patch });
      await onChanged();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {editing ? (
        <>
          <input
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13.5px] text-white outline-none focus:border-white/30"
            onChange={(e) => setDescription(e.target.value)}
            value={description}
          />
          <textarea
            className="min-h-64 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[12.5px] text-white outline-none focus:border-white/30"
            onChange={(e) => setBody(e.target.value)}
            value={body}
          />
        </>
      ) : (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13.5px] text-neutral-300">
          <MessageResponse>{skill.body}</MessageResponse>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <button className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-[12.5px] font-medium text-black" disabled={saving} onClick={() => void save({ body, description })} type="button">
            {saving ? <Loader2Icon className="size-3.5 animate-spin" /> : null} Save
          </button>
        ) : (
          <button className="inline-flex h-8 items-center rounded-full border border-white/15 px-3.5 text-[12.5px] text-white hover:bg-white/[0.06]" onClick={() => setEditing(true)} type="button">
            Edit
          </button>
        )}
        {skill.draft ? (
          <button className="inline-flex h-8 items-center rounded-full border border-emerald-400/30 px-3.5 text-[12.5px] text-emerald-200 hover:bg-emerald-400/10" onClick={() => void save({ draft: false })} type="button">
            Mark reviewed
          </button>
        ) : null}
        <button
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-red-300 hover:bg-red-500/10"
          onClick={async () => {
            if (!window.confirm(`Delete /${skill.slug}?`)) return;
            await api(`/api/skills/${skill.id}`, { method: "DELETE" });
            await onChanged();
          }}
          type="button"
        >
          <Trash2Icon className="size-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}

export function SkillsLibrary() {
  const { state } = useAppState();
  const { data, refresh } = usePoll<{ skills: Skill[] }>("/api/skills", 10_000);
  const [openId, setOpenId] = useState<string>();
  const skills = data?.skills ?? [];
  if (data && skills.length === 0) {
    return <EmptyState body="Ask any Bot: “Save the process we used for this as a skill called Weekly report.”" title="No skills yet" />;
  }
  return (
    <ul className="space-y-2">
      {skills.map((s) => {
        const open = openId === s.id;
        const author = state.bots.find((b) => b.id === s.createdByBotId);
        return (
          <li className={cn("rounded-[20px] border bg-[#0a0a0b]", open ? "border-white/20" : "border-white/10")} key={s.id}>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpenId(open ? undefined : s.id)} type="button">
              <span className="font-mono text-[13px] text-white">/{s.slug}</span>
              {s.draft ? <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300">Draft</span> : null}
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-neutral-500">{s.description}</span>
              <span className="shrink-0 text-[11.5px] text-neutral-600">
                {author ? `${author.name} · ` : ""}
                {timeAgo(s.updatedAt)}
              </span>
            </button>
            {open ? (
              <div className="border-t border-white/[0.06] px-4 py-3">
                <SkillEditor onChanged={refresh} skill={s} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
