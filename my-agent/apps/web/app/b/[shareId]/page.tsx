import Link from "next/link";
import { notFound } from "next/navigation";
import { BotAvatar, BezLogo } from "@/components/bez/bot-avatar";
import { currentUser } from "@/lib/session";
import { describeSchedule } from "@shared/schedule";
import { getSharedBot } from "@shared/store/repo";
import { AddSharedBot } from "./add-shared-bot";

export async function generateMetadata({ params }: { readonly params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const shared = await getSharedBot(shareId);
  if (!shared) return { title: "Bot" };
  const description = `${shared.label} ${shared.description}`.slice(0, 160);
  return { title: shared.name, description, openGraph: { title: shared.name, description } };
}

/** Public page for a shared Bot, mirroring x.ai/bot/<id>: name, what it does, "Add to Bez Bot". */
export default async function SharedBotPage({ params }: { readonly params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const [shared, user] = await Promise.all([getSharedBot(shareId), currentUser()]);
  if (!shared) notFound();
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-black px-5 py-20">
      <div className="pointer-events-none absolute top-0 left-1/2 size-[560px] -translate-x-1/2 rounded-full opacity-20 blur-3xl" style={{ background: shared.color }} />
      <div className="relative w-full max-w-md space-y-8 text-center">
        <Link className="inline-flex" href="/">
          <BezLogo className="text-[15px] text-neutral-400" />
        </Link>
        <div className="flex justify-center">
          <BotAvatar color={shared.color} emoji={shared.emoji} size="xl" />
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-medium tracking-tight text-white">{shared.name}</h1>
          <p className="text-[17px] text-neutral-300">{shared.label}</p>
          {shared.description ? (
            <p className="line-clamp-4 text-[15px] leading-relaxed text-neutral-500">{shared.description.split("\n\n")[0]}</p>
          ) : null}
        </div>
        {(shared.skills ?? []).length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left">
            <div className="text-[12.5px] text-neutral-500">Skills · playbooks it can run</div>
            {shared.skills.map((s) => (
              <div className="text-[14px] text-neutral-300" key={s.slug}>
                /{s.slug} <span className="text-neutral-600">· {s.description}</span>
              </div>
            ))}
          </div>
        ) : null}
        {shared.routines.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left">
            <div className="text-[12.5px] text-neutral-500">Includes routines</div>
            {shared.routines.map((r) => (
              <div className="text-[14px] text-neutral-300" key={r.name}>
                {r.name} <span className="text-neutral-600">· {describeSchedule(r.schedule)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="text-[12.5px] leading-relaxed text-neutral-600">
          This AI bot was created by {shared.authorName}, a Bez Bot user, not by {"Bez Labs"}. It may act on your behalf. By clicking “Add to Bez Bot”, you accept the{" "}
          <Link className="underline underline-offset-2" href="/guides/security#terms">
            terms
          </Link>
          .
        </p>
        <AddSharedBot shareId={shared.shareId} signedIn={Boolean(user)} />
        <p className="text-[13px] text-neutral-500">
          Don&apos;t have Bez Bot?{" "}
          <Link className="text-white" href="/download">
            Download
          </Link>
        </p>
      </div>
    </main>
  );
}
