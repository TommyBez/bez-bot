import { cn } from "@/lib/utils";
import type { BotStatus } from "@shared/store/types";

export function BotAvatar({
  emoji,
  color,
  name,
  size = "md",
  status,
  className,
}: {
  readonly emoji?: string;
  readonly color?: string;
  readonly name?: string;
  readonly size?: "xs" | "sm" | "md" | "lg" | "xl";
  readonly status?: BotStatus;
  readonly className?: string;
}) {
  const sizes = {
    xs: "size-5 text-[11px] rounded-md",
    sm: "size-7 text-sm rounded-lg",
    md: "size-9 text-base rounded-xl",
    lg: "size-12 text-xl rounded-2xl",
    xl: "size-16 text-3xl rounded-3xl",
  } as const;
  const tint = color ?? "#a3a3a3";
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        aria-label={name}
        className={cn("inline-flex items-center justify-center border border-white/10", sizes[size])}
        style={{
          background: `linear-gradient(145deg, ${tint}33 0%, ${tint}14 100%)`,
          boxShadow: `inset 0 1px 0 ${tint}40`,
        }}
      >
        <span aria-hidden>{emoji ?? name?.slice(0, 1).toUpperCase() ?? "B"}</span>
      </span>
      {status ? <StatusDot className="absolute -right-0.5 -bottom-0.5" status={status} /> : null}
    </span>
  );
}

export function botStatusLabel(status: string, text?: string): string {
  if (status === "working") return text ?? "Working";
  if (status === "attention") return text ?? "Needs attention";
  if (status === "error") return "Hit an error";
  return "Idle";
}

export function StatusDot({ status, className }: { readonly status: BotStatus; readonly className?: string }) {
  const colors = {
    idle: "bg-neutral-500",
    working: "bg-emerald-400 animate-pulse-dot",
    attention: "bg-amber-400",
    error: "bg-red-500",
  } as const;
  return <span className={cn("size-2.5 rounded-full ring-2 ring-black", colors[status], className)} />;
}

export function BezMark({ className }: { readonly className?: string }) {
  return (
    <svg aria-hidden className={cn("size-6", className)} fill="none" viewBox="0 0 32 32">
      <rect height="30" rx="9" stroke="currentColor" strokeOpacity="0.9" strokeWidth="2" width="30" x="1" y="1" />
      <circle cx="11.5" cy="14" fill="currentColor" r="2.6" />
      <circle cx="20.5" cy="14" fill="currentColor" r="2.6" />
      <path d="M10.5 20.5c1.6 1.6 3.4 2.4 5.5 2.4s3.9-.8 5.5-2.4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function BezLogo({ className }: { readonly className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-medium tracking-tight", className)}>
      <BezMark />
      <span>Bez Bot</span>
    </span>
  );
}
