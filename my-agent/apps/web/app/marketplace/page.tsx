import Link from "next/link";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { MarketingShell, PageHeader } from "@/components/marketing/page-shell";
import { TEMPLATES } from "@shared/templates";

export const metadata = { title: "Marketplace" };

export default function MarketplacePage() {
  const categories = Array.from(new Set(TEMPLATES.map((t) => t.category)));
  return (
    <MarketingShell>
      <PageHeader
        body="Hire a Bot for any job. Each one comes with a persona, routines it can run on a schedule, and teammates it knows how to work with."
        eyebrow="Bez Bot Marketplace"
        title="Explore more bots"
      />
      <div className="mx-auto max-w-7xl space-y-16 px-5 pb-28 sm:px-8">
        {categories.map((category) => (
          <section key={category}>
            <h2 className="mb-5 text-[15px] font-medium text-neutral-400">{category}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TEMPLATES.filter((t) => t.category === category).map((template) => (
                <Link
                  className="group relative flex flex-col justify-between gap-8 overflow-hidden rounded-[24px] border border-white/10 bg-[#0a0a0b] p-6 transition-colors hover:border-white/25"
                  href={`/marketplace/${template.id}`}
                  key={template.id}
                >
                  <div
                    className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-25"
                    style={{ background: template.color }}
                  />
                  <div className="relative space-y-4">
                    <BotAvatar color={template.color} emoji={template.emoji} size="lg" />
                    <div>
                      <div className="text-[17px] text-white">{template.name}</div>
                      <div className="text-[14px] text-neutral-300">{template.job}</div>
                    </div>
                    <p className="text-[13.5px] leading-relaxed text-neutral-500">{template.description}</p>
                  </div>
                  <div className="relative flex flex-wrap gap-1.5">
                    {template.tools.slice(0, 4).map((tool) => (
                      <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11.5px] text-neutral-500" key={tool}>
                        {tool}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </MarketingShell>
  );
}
