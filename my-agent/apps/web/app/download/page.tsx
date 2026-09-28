import { GlobeIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import Link from "next/link";
import { MarketingShell, PageHeader } from "@/components/marketing/page-shell";
import { InstallButton } from "./install-button";

export const metadata = { title: "Download" };

export default function DownloadPage() {
  return (
    <MarketingShell>
      <PageHeader body="One team, wherever you are — on your desk and in your pocket." eyebrow="Download" title="Download Bez Bot" />
      <div className="mx-auto grid max-w-7xl gap-4 px-5 pb-28 sm:px-8 lg:grid-cols-3">
        <section className="flex flex-col justify-between gap-10 rounded-[28px] border border-white/10 bg-[#0a0a0b] p-7">
          <div className="space-y-3">
            <GlobeIcon className="size-7 text-neutral-400" />
            <h2 className="text-2xl font-medium text-white">Web</h2>
            <p className="text-[14.5px] text-neutral-400">Works in any modern browser. Nothing to install.</p>
          </div>
          <Link className="inline-flex h-11 items-center justify-center rounded-full bg-white text-[14.5px] font-medium text-black hover:bg-neutral-200" href="/app">
            Open Bez Bot
          </Link>
        </section>
        <section className="flex flex-col justify-between gap-10 rounded-[28px] border border-white/10 bg-[#0a0a0b] p-7">
          <div className="space-y-3">
            <MonitorIcon className="size-7 text-neutral-400" />
            <h2 className="text-2xl font-medium text-white">Desktop</h2>
            <p className="text-[14.5px] text-neutral-400">
              Install Bez Bot as an app on macOS, Windows, or Linux from Chrome, Edge, or Arc. It opens in its own window and keeps your Bots one click away.
            </p>
          </div>
          <InstallButton />
        </section>
        <section className="flex flex-col justify-between gap-10 rounded-[28px] border border-white/10 bg-[#0a0a0b] p-7" id="mobile">
          <div className="space-y-3">
            <SmartphoneIcon className="size-7 text-neutral-400" />
            <h2 className="text-2xl font-medium text-white">iPhone & Android</h2>
            <p className="text-[14.5px] text-neutral-400">
              Open Bez Bot in Safari or Chrome, tap Share, then “Add to Home Screen”. Approve actions and message your Bots from anywhere.
            </p>
          </div>
          <Link className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 text-[14.5px] text-white hover:bg-white/[0.06]" href="/app">
            Open on this device
          </Link>
        </section>
      </div>
    </MarketingShell>
  );
}
