"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client";

/**
 * Works before and after hydration: without JS it posts the form and the
 * route redirects; with JS it submits JSON and navigates.
 */
export function LoginForm({ next }: { readonly next: string }) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    try {
      await api("/api/auth/login", {
        method: "POST",
        json: {
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setPending(false);
    }
  }

  return (
    <form action="/api/auth/login" className="space-y-3" method="post" onSubmit={submit}>
      <input name="next" type="hidden" value={next} />
      <input
        autoComplete="name"
        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-[15px] text-white outline-none placeholder:text-neutral-600 focus:border-white/30"
        name="name"
        placeholder="Your name"
      />
      <input
        autoComplete="email"
        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-[15px] text-white outline-none placeholder:text-neutral-600 focus:border-white/30"
        name="email"
        placeholder="you@company.com"
        required
        type="email"
      />
      {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
      <button
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
        Continue
      </button>
    </form>
  );
}
