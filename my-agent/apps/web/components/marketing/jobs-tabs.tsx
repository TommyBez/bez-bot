"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { cn } from "@/lib/utils";
import { FEATURED_TEMPLATES } from "@shared/templates";

export function JobsTabs() {
  const [activeId, setActiveId] = useState(FEATURED_TEMPLATES[0]!.id);
  const active = FEATURED_TEMPLATES.find((t) => t.id === activeId) ?? FEATURED_TEMPLATES[0]!;
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0" role="tablist">
        {FEATURED_TEMPLATES.map((template) => (
          <button
            aria-selected={template.id === activeId}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[14.5px] transition-colors",
              template.id === activeId
                ? "border-white/20 bg-white/[0.06] text-white"
                : "border-transparent text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200",
            )}
            key={template.id}
            onClick={() => setActiveId(template.id)}
            role="tab"
            type="button"
          >
            <BotAvatar color={template.color} emoji={template.emoji} size="sm" />
            {template.name}
          </button>
        ))}
      </div>
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0a0b] p-8 sm:p-10" role="tabpanel">
        <div
          className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full opacity-30 blur-3xl"
          style={{ background: active.color }}
        />
        <div className="relative flex h-full flex-col justify-between gap-10">
          <div className="space-y-5">
            <BotAvatar color={active.color} emoji={active.emoji} size="xl" />
            <h3 className="max-w-xl text-3xl leading-tight font-medium tracking-tight text-white sm:text-4xl">
              {active.job} <span className="font-normal text-neutral-500">{active.description}</span>
            </h3>
          </div>
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {active.tools.map((tool) => (
                <span className="rounded-full border border-white/10 px-3 py-1 text-[12.5px] text-neutral-400" key={tool}>
                  {tool}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-medium text-black hover:bg-neutral-200"
                href={`/app/bots/new?template=${active.id}`}
              >
                Hire {active.name}
              </Link>
              <Link className="inline-flex items-center gap-1.5 text-[14px] text-neutral-300 hover:text-white" href="/marketplace">
                Explore more bots <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
