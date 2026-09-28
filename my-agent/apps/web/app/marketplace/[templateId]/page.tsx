import { ArrowLeftIcon, CalendarClockIcon, MessagesSquareIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotAvatar } from "@/components/bez/bot-avatar";
import { MarketingShell } from "@/components/marketing/page-shell";
import { describeSchedule } from "@shared/schedule";
import { getTemplate, TEMPLATES } from "@shared/templates";

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ templateId: t.id }));
}

export async function generateMetadata({ params }: { readonly params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const template = getTemplate(templateId);
  return { title: template ? `${template.name} Bot` : "Bot", description: template?.description };
}

export default async function TemplatePage({ params }: { readonly params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const template = getTemplate(templateId);
  if (!template) notFound();
  const collaborators = template.collaborators.map((id) => getTemplate(id)).filter((t) => t !== undefined);

  return (
    <MarketingShell>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full opacity-20 blur-3xl" style={{ background: template.color }} />
        <div className="relative mx-auto max-w-4xl px-5 pt-16 pb-28 sm:px-8">
          <Link className="mb-10 inline-flex items-center gap-1.5 text-[13.5px] text-neutral-500 hover:text-white" href="/marketplace">
            <ArrowLeftIcon className="size-4" /> Marketplace
          </Link>
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-5">
              <BotAvatar color={template.color} emoji={template.emoji} size="xl" />
              <div>
                <h1 className="text-5xl font-medium tracking-tight text-white">{template.name}</h1>
                <p className="mt-3 text-[20px] text-neutral-300">{template.job}</p>
              </div>
              <p className="max-w-2xl text-[16px] leading-relaxed text-neutral-400">{template.description}</p>
            </div>
            <Link
              className="inline-flex h-11 shrink-0 items-center rounded-full bg-white px-6 text-[14.5px] font-medium text-black hover:bg-neutral-200"
              href={`/app/bots/new?template=${template.id}`}
            >
              Add to Bez Bot
            </Link>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            <section className="rounded-[24px] border border-white/10 bg-[#0a0a0b] p-6">
              <h2 className="mb-4 flex items-center gap-2 text-[15px] text-white">
                <MessagesSquareIcon className="size-4 text-neutral-500" /> Try asking
              </h2>
              <ul className="space-y-2">
                {template.starters.map((starter) => (
                  <li className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[14px] text-neutral-300" key={starter}>
                    “{starter}”
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-[24px] border border-white/10 bg-[#0a0a0b] p-6">
              <h2 className="mb-4 flex items-center gap-2 text-[15px] text-white">
                <CalendarClockIcon className="size-4 text-neutral-500" /> Routines included
              </h2>
              {template.routines.length === 0 ? (
                <p className="text-[14px] text-neutral-500">Teach it a routine by showing it once.</p>
              ) : (
                <ul className="space-y-3">
                  {template.routines.map((routine) => (
                    <li key={routine.name}>
                      <div className="text-[14px] text-neutral-200">{routine.name}</div>
                      <div className="text-[13px] text-neutral-500">
                        {describeSchedule(routine.schedule ? { ...routine.schedule, timezone: "your timezone" } : null)} ·{" "}
                        {routine.description}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {collaborators.length > 0 ? (
            <section className="mt-4 rounded-[24px] border border-white/10 bg-[#0a0a0b] p-6">
              <h2 className="mb-4 text-[15px] text-white">Works well with</h2>
              <div className="flex flex-wrap gap-2">
                {collaborators.map((c) => (
                  <Link
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 py-1 pr-3 pl-1 text-[13.5px] text-neutral-300 hover:border-white/25"
                    href={`/marketplace/${c.id}`}
                    key={c.id}
                  >
                    <BotAvatar color={c.color} emoji={c.emoji} size="xs" />
                    {c.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <p className="mt-10 text-[12.5px] text-neutral-600">
            Bots may act on your behalf. Sensitive actions go through Auto Review, and you can change what each Bot is allowed to do at any time.
          </p>
        </div>
      </div>
    </MarketingShell>
  );
}
