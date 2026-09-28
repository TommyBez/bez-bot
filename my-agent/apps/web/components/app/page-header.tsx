import type { ReactNode } from "react";

export function AppPage({ children, wide = false }: { readonly children: ReactNode; readonly wide?: boolean }) {
  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className={`mx-auto w-full px-5 pt-16 pb-20 sm:px-8 md:pt-10 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>{children}</div>
    </div>
  );
}

export function AppHeader({ title, body, actions }: { readonly title: string; readonly body?: ReactNode; readonly actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-medium tracking-tight text-white">{title}</h1>
        {body ? <div className="text-[14.5px] text-neutral-400">{body}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { readonly children: ReactNode; readonly className?: string }) {
  return <div className={`rounded-[20px] border border-white/10 bg-[#0a0a0b] ${className}`}>{children}</div>;
}

export function EmptyState({ title, body, action }: { readonly title: string; readonly body?: string; readonly action?: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-dashed border-white/10 px-6 py-12 text-center">
      <div className="text-[15px] text-white">{title}</div>
      {body ? <div className="mx-auto mt-1 max-w-md text-[13.5px] text-neutral-500">{body}</div> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export const buttonPrimary =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-[13.5px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-50";
export const buttonSecondary =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/15 px-4 text-[13.5px] text-white transition-colors hover:bg-white/[0.06] disabled:opacity-50";
export const buttonGhost =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50";
export const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-neutral-600 focus:border-white/30";
