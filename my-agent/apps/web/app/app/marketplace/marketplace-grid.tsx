"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppState } from "@/components/app/app-state";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Bot } from "@shared/store/types";
import { TEMPLATES } from "@shared/templates";

export function MarketplaceGrid() {
  const router = useRouter();
  const { state, refresh } = useAppState();
  const [category, setCategory] = useState("All");
  const [busy, setBusy] = useState<string>();
  const templates = TEMPLATES.filter((t) => t.id !== "blank");
  const categories = ["All", ...new Set(templates.map((t) => t.category))];
  const shown = templates.filter((t) => category === "All" || t.category === category);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            className={cn("rounded-full px-3 py-1 text-[12.5px]", category === c ? "bg-white text-black" : "border border-white/10 text-neutral-400 hover:text-white")}
            key={c}
            onClick={() => setCategory(c)}
            type="button"
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((t) => {
          const added = state.bots.find((b) => b.templateId === t.id);
          return (
            <div className="flex flex-col gap-3 rounded-[20px] border border-white/10 bg-[#0a0a0b] p-4" key={t.id}>
              <div className="flex items-center gap-3">
                <BotAvatar color={t.color} emoji={t.emoji} size="md" />
                <div className="min-w-0">
                  <div className="text-[14.5px] text-white">{t.name}</div>
                  <div className="truncate text-[12.5px] text-neutral-500">{t.job}</div>
                </div>
              </div>
              <p className="flex-1 text-[13px] text-neutral-400">{t.description}</p>
              <div className="flex flex-wrap gap-1">
                {t.tools.map((tool) => (
                  <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[11px] text-neutral-500" key={tool}>
                    {tool}
                  </span>
                ))}
              </div>
              <button
                className={cn(
                  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium",
                  added ? "border border-white/15 text-white hover:bg-white/[0.06]" : "bg-white text-black hover:bg-neutral-200",
                )}
                disabled={!!busy}
                onClick={async () => {
                  if (added) return router.push(`/app/bots/${added.id}`);
                  setBusy(t.id);
                  try {
                    const { bot } = await api<{ bot: Bot }>("/api/bots", { method: "POST", json: { templateId: t.id } });
                    await refresh();
                    router.push(`/app/bots/${bot.id}`);
                  } finally {
                    setBusy(undefined);
                  }
                }}
                type="button"
              >
                {busy === t.id ? <Loader2Icon className="size-4 animate-spin" /> : added ? <CheckIcon className="size-4" /> : null}
                {added ? `Open ${added.name}` : "Add"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
