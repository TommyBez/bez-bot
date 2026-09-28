import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing/page-shell";
import { getGuide, GUIDES } from "@/lib/guides";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { readonly params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  return { title: guide?.title ?? "Guide", description: guide?.summary };
}

export default async function GuidePage({ params }: { readonly params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 pt-16 pb-28 sm:px-8">
        <Link className="mb-10 inline-flex items-center gap-1.5 text-[13.5px] text-neutral-500 hover:text-white" href="/guides">
          <ArrowLeftIcon className="size-4" /> Guides
        </Link>
        <div className="mb-3 text-[13px] text-neutral-500">
          {guide.audience} · {guide.minutes} min read
        </div>
        <h1 className="text-gradient text-5xl leading-[1.05] font-medium tracking-tight sm:text-6xl">{guide.title}</h1>
        <p className="mt-6 text-[19px] leading-relaxed text-neutral-400">{guide.summary}</p>
        <div className="mt-14 space-y-12">
          {guide.sections.map((section) => (
            <section className="space-y-4" id={section.heading.toLowerCase().split(" ")[0]} key={section.heading}>
              <h2 className="text-[26px] font-medium tracking-tight text-white">{section.heading}</h2>
              {section.body.map((p) => (
                <p className="text-[16.5px] leading-[1.75] text-neutral-300" key={p.slice(0, 40)}>
                  {p}
                </p>
              ))}
              {section.bullets ? (
                <ul className="list-disc space-y-2 pl-5 text-[16px] text-neutral-300 marker:text-neutral-600">
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
        <div className="mt-16 rounded-[24px] border border-white/10 p-8 text-center">
          <h2 className="text-2xl font-medium text-white">Meet your first Bot</h2>
          <Link
            className="mt-5 inline-flex h-11 items-center rounded-full bg-white px-6 text-[14.5px] font-medium text-black hover:bg-neutral-200"
            href="/app/bots/new"
          >
            Get started for free
          </Link>
        </div>
      </article>
    </MarketingShell>
  );
}
