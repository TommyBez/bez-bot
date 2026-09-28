import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingNav } from "@/components/marketing/nav";
import { currentUser } from "@/lib/session";

export async function MarketingShell({ children }: { readonly children: ReactNode }) {
  const user = await currentUser();
  return (
    <div className="min-h-dvh bg-black text-white">
      <MarketingNav signedIn={Boolean(user)} />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}

export function PageHeader({ eyebrow, title, body }: { readonly eyebrow?: string; readonly title: string; readonly body?: string }) {
  return (
    <header className="relative overflow-hidden">
      <div className="glow pointer-events-none absolute inset-x-0 top-0 h-[400px]" />
      <div className="relative mx-auto max-w-7xl px-5 pt-20 pb-12 sm:px-8 sm:pt-28">
        {eyebrow ? <div className="mb-4 text-[13px] text-neutral-500">{eyebrow}</div> : null}
        <h1 className="text-gradient max-w-4xl text-5xl leading-[1.02] font-medium tracking-tight sm:text-7xl">{title}</h1>
        {body ? <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-neutral-400">{body}</p> : null}
      </div>
    </header>
  );
}
