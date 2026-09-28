import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { MarketingShell, PageHeader } from "@/components/marketing/page-shell";
import { GUIDES } from "@/lib/guides";

export const metadata = { title: "Guides" };

export default function GuidesPage() {
  return (
    <MarketingShell>
      <PageHeader body="How PMs, designers, and GTM run Bez Bot day to day." eyebrow="Bez Bot Guides" title="Guides" />
      <div className="mx-auto grid max-w-7xl gap-4 px-5 pb-28 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
        {GUIDES.map((guide) => (
          <Link
            className="group flex flex-col justify-between gap-10 rounded-[24px] border border-white/10 bg-[#0a0a0b] p-6 transition-colors hover:border-white/25"
            href={`/guides/${guide.slug}`}
            key={guide.slug}
          >
            <div className="space-y-3">
              <div className="text-[12.5px] text-neutral-500">
                {guide.audience} · {guide.minutes} min read
              </div>
              <h2 className="text-[22px] leading-snug font-medium tracking-tight text-white">{guide.title}</h2>
              <p className="text-[14.5px] text-neutral-400">{guide.summary}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[14px] text-neutral-300 group-hover:text-white">
              Read <ArrowRightIcon className="size-4" />
            </span>
          </Link>
        ))}
      </div>
    </MarketingShell>
  );
}
