import { PlusIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: "How is Bez Bot different from AI assistants?",
    a: "Bots have their own computer, so they can work inside your apps and tools. They also run in parallel, 24/7, even when your laptop is closed, and they message each other to hand off work without waiting on you.",
  },
  {
    q: "Who is Bez Bot available for today?",
    a: "Bez Bot is available on every Bez plan, including the free tier for trying it out, and for teams on Bez Teams and Enterprise.",
  },
  {
    q: "Is Bez Bot available for enterprises?",
    a: (
      <>
        Yes. Bez Bot is generally available for Enterprise, as well as for teams and businesses on Bez plans.{" "}
        <Link className="text-white underline underline-offset-4" href="mailto:sales@bezbot.dev">
          Contact sales
        </Link>{" "}
        to set up Enterprise access for your organization, including people who don&apos;t already have a seat.
      </>
    ),
  },
  {
    q: "Where do I talk to Bez Bot?",
    a: "Work with Bez Bot from any browser on desktop, install it as an app, or add it to your phone's home screen. Every conversation, group chat, and approval follows you across devices.",
  },
  {
    q: "How do Bots talk to each other?",
    a: "Any Bot can message a teammate Bot with a request. It lands in the teammate's own conversation and wakes it up; the teammate does the work on the shared computer and replies, which wakes the first Bot so it can keep going. Put two to six Bots in a group chat and they coordinate on their own; you only step in for decisions and approvals.",
  },
  {
    q: "How much does Bez Bot cost?",
    a: "Bez Bot subscriptions come with weekly usage included, with additional usage billed based on token cost. Enterprise customers should contact sales.",
  },
  {
    q: "Do Bots share one computer?",
    a: "Yes. Every Bot shares one persistent cloud computer per user, and each Bot gets its own screen on it. Your Bots share its files, browser sessions, and saved logins, so they can hand work off and keep context. Isolation is per user, not per Bot.",
  },
  {
    q: "How does Bez Bot handle my data & privacy?",
    a: "Your computer runs in an isolated sandbox. Saved logins are encrypted at rest and are typed into the computer without ever being shown to the model. Sensitive actions go through Auto Review before they run, and you choose per Bot whether to always ask, auto-review, or trust it.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
      {FAQS.map((item) => (
        <details className="group py-5" key={item.q}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] text-white">
            {item.q}
            <PlusIcon className="size-5 shrink-0 text-neutral-500 transition-transform group-open:rotate-45" />
          </summary>
          <div className="mt-3 max-w-3xl text-[15px] leading-relaxed text-neutral-400">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
