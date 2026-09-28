import { ArrowRightIcon, GlobeIcon, MonitorIcon, PlayIcon, SmartphoneIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Faq } from "@/components/marketing/faq";
import { MarketingFooter } from "@/components/marketing/footer";
import { JobsTabs } from "@/components/marketing/jobs-tabs";
import {
  ComputerMock,
  ConnectMock,
  HeroAppMock,
  ManyBotsMock,
  MemoryMock,
  MessageMock,
  TeachMock,
} from "@/components/marketing/mocks";
import { MarketingNav } from "@/components/marketing/nav";
import { Pricing } from "@/components/marketing/pricing";
import { currentUser } from "@/lib/session";

function Feature({
  title,
  body,
  visual,
  reverse = false,
  id,
}: {
  readonly title: string;
  readonly body: ReactNode;
  readonly visual: ReactNode;
  readonly reverse?: boolean;
  readonly id?: string;
}) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28" id={id}>
      <div className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-20 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div className="max-w-lg space-y-5">
          <h2 className="text-4xl leading-[1.05] font-medium tracking-tight text-white sm:text-5xl">{title}</h2>
          <div className="text-[17px] leading-relaxed text-neutral-400">{body}</div>
        </div>
        <div>{visual}</div>
      </div>
    </section>
  );
}

export default async function LandingPage() {
  const user = await currentUser();
  const primaryHref = user ? "/app" : "/login?mode=signup";

  return (
    <div className="min-h-dvh bg-black text-white">
      <MarketingNav signedIn={Boolean(user)} />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="grid-fade pointer-events-none absolute inset-0" />
          <div className="glow pointer-events-none absolute inset-x-0 top-0 h-[600px]" />
          <div className="relative mx-auto flex max-w-7xl flex-col items-center px-5 pt-20 pb-16 text-center sm:px-8 sm:pt-28">
            <Link
              className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[13px] text-neutral-300 hover:border-white/20"
              href="/guides/introducing-bez-bot"
            >
              <span className="text-white">Bez Bot is here</span>
              <span className="text-neutral-600">•</span>
              <span>Read the launch post</span>
              <ArrowRightIcon className="size-3.5" />
            </Link>
            <h1 className="text-gradient flex flex-col text-[64px] leading-[0.9] font-medium tracking-[-0.045em] sm:text-[112px] lg:text-[148px]">
              <span className="text-[0.42em] tracking-[-0.03em] text-neutral-500">Meet</span>
              <span>Bez Bot</span>
            </h1>
            <p className="mt-8 max-w-2xl text-[18px] leading-relaxed text-neutral-400 sm:text-[20px]">
              AI teammates you can give real work to. Bots can sign in to your tools, use them just like you do, and come
              back with finished work.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
              <Link
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-medium text-black hover:bg-neutral-200"
                href={primaryHref}
              >
                {user ? "Open Bez Bot" : "Get started for free"}
              </Link>
              <Link
                className="inline-flex h-12 items-center rounded-full border border-white/15 px-7 text-[15px] text-white hover:bg-white/[0.06]"
                href="mailto:sales@bezbot.dev"
              >
                Contact sales
              </Link>
            </div>
          </div>
          <div className="relative mx-auto max-w-7xl px-5 pb-24 sm:px-8">
            <HeroAppMock />
          </div>
        </section>

        <Feature
          body="Give tasks to Bots like you would a teammate on desktop or mobile. Your AI teammates take projects from start to end, keep context on how you work and get smarter over time, and come back when your approval is needed."
          title="Message Bots like teammates"
          visual={<MessageMock />}
        />

        <Feature
          body="Create a Bot, give it a task, and add another when the work grows—one on a project, one on outbound, one on systems. AI teammates work in parallel, collaborate where it makes sense, and keep working 24/7."
          reverse
          title="Work with many Bots at once"
          visual={<ManyBotsMock />}
        />

        <Feature
          body="Log Bez Bot in once. It uses your apps and websites just like you would, including the tools that are harder to navigate. Every Bot has its own computer with a browser and a terminal."
          title="Bez Bot works where you work"
          visual={<ComputerMock />}
        />

        <Feature
          body="Ask a Bot to follow along as you complete a workflow once. It saves it as a routine and runs it on its own next time."
          reverse
          title="Show a Bot how it's done"
          visual={<TeachMock />}
        />

        <Feature
          body="Bots keep context and learn from each other. Show one a workflow today, hand off the project by Friday."
          title="Bots get smarter over time"
          visual={<MemoryMock />}
        />

        <Feature
          body="Put a few Bots in the same group chat and they pass work between themselves. Bots message each other on their own, asking for context and handing off tasks. You watch them take action instead of approving every step."
          id="connect"
          reverse
          title="Connect the Bots"
          visual={<ConnectMock />}
        />

        {/* Jobs */}
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28" id="jobs">
          <h2 className="mb-12 text-4xl font-medium tracking-tight text-white sm:text-5xl">Give each Bot a job</h2>
          <JobsTabs />
        </section>

        {/* Video */}
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <h2 className="mb-10 text-center text-3xl font-medium tracking-tight text-white sm:text-4xl">
            The Bez Labs team runs on Bez Bot
          </h2>
          <div className="relative mx-auto aspect-video max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(ellipse_at_top,#1f1f24,#050505)]">
            <div className="grid-fade absolute inset-0" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Link
                className="flex size-20 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
                href="/guides/introducing-bez-bot"
              >
                <PlayIcon className="size-7 translate-x-0.5 fill-black" />
                <span className="sr-only">Play</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28" id="pricing">
          <div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <h2 className="text-4xl font-medium tracking-tight text-white sm:text-5xl">Pricing</h2>
            <Link className="text-[14px] text-neutral-400 hover:text-white" href="mailto:sales@bezbot.dev">
              Contact sales
            </Link>
          </div>
          <Pricing />
        </section>

        {/* Download */}
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8" id="download">
          <div className="grid gap-10 rounded-[32px] border border-white/10 bg-[#070708] p-8 sm:p-12 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4">
              <h2 className="text-4xl font-medium tracking-tight text-white">Download Bez Bot</h2>
              <p className="text-[17px] text-neutral-400">One team, wherever you are — on your desk and in your pocket.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { icon: GlobeIcon, title: "Web", detail: "Any browser", href: primaryHref, cta: "Open" },
                { icon: MonitorIcon, title: "Desktop", detail: "Install as an app", href: "/download", cta: "Install" },
                { icon: SmartphoneIcon, title: "Mobile", detail: "iOS & Android", href: "/download#mobile", cta: "Add" },
              ].map((item) => (
                <Link
                  className="group flex flex-col justify-between gap-8 rounded-2xl border border-white/10 p-5 transition-colors hover:border-white/25"
                  href={item.href}
                  key={item.title}
                >
                  <item.icon className="size-6 text-neutral-400 group-hover:text-white" />
                  <div>
                    <div className="text-[15px] text-white">{item.title}</div>
                    <div className="text-[13px] text-neutral-500">{item.detail}</div>
                  </div>
                </Link>
              ))}
              <Link className="text-[13px] text-neutral-500 hover:text-white sm:col-span-3" href="/download">
                More downloads · Other platforms and devices
              </Link>
            </div>
          </div>
        </section>

        {/* Guides */}
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <Link
            className="group flex flex-col justify-between gap-6 rounded-[32px] border border-white/10 p-8 transition-colors hover:border-white/25 sm:flex-row sm:items-center sm:p-12"
            href="/guides"
          >
            <div className="space-y-3">
              <h2 className="text-3xl font-medium tracking-tight text-white sm:text-4xl">Bez Bot Guides</h2>
              <p className="text-[17px] text-neutral-400">How PMs, designers, and GTM run Bez Bot day to day.</p>
            </div>
            <span className="inline-flex items-center gap-2 text-[15px] text-white">
              Read the guides <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-4xl px-5 py-20 sm:px-8" id="faq">
          <h2 className="mb-10 text-4xl font-medium tracking-tight text-white sm:text-5xl">FAQs</h2>
          <Faq />
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden">
          <div className="glow pointer-events-none absolute inset-0" />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 py-28 text-center sm:px-8">
            <h2 className="text-gradient text-5xl font-medium tracking-tight sm:text-7xl">Meet your first Bot</h2>
            <p className="mt-5 text-[18px] text-neutral-400">An AI teammate you can trust to get work done</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex h-12 items-center rounded-full bg-white px-7 text-[15px] font-medium text-black hover:bg-neutral-200"
                href={user ? "/app/bots/new" : "/login?mode=signup"}
              >
                Get started for free
              </Link>
              <Link
                className="inline-flex h-12 items-center rounded-full border border-white/15 px-7 text-[15px] text-white hover:bg-white/[0.06]"
                href="mailto:sales@bezbot.dev"
              >
                Contact sales
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
