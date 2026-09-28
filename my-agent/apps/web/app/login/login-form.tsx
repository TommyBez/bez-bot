"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";

const field =
  "h-12 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-[15px] text-white outline-none placeholder:text-neutral-600 focus:border-white/30";

/**
 * Works before and after hydration: without JS it posts the form and the
 * route redirects; with JS it submits JSON and navigates.
 */
export function LoginForm({
  next,
  mode,
  initialError,
}: {
  readonly next: string;
  readonly mode: "signin" | "signup";
  readonly initialError?: string;
}) {
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);
  const signup = mode === "signup";
  const action = signup ? "/api/auth/signup" : "/api/auth/login";
  const other = `/login?${new URLSearchParams({ mode: signup ? "signin" : "signup", next })}`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    try {
      await api(action, {
        method: "POST",
        json: {
          ...(signup ? { name: String(form.get("name") ?? "") } : {}),
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
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
    <div className="space-y-5">
      <form action={action} className="space-y-3" method="post" onSubmit={submit}>
        <input name="next" type="hidden" value={next} />
        {signup ? <input autoComplete="name" className={field} name="name" placeholder="Your name" /> : null}
        <input autoComplete="email" className={field} name="email" placeholder="you@company.com" required type="email" />
        <input
          autoComplete={signup ? "new-password" : "current-password"}
          className={field}
          minLength={signup ? 8 : undefined}
          name="password"
          placeholder={signup ? "Password (8+ characters)" : "Password"}
          required
          type="password"
        />
        {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
        <button
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {signup ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="text-center text-[13.5px] text-neutral-400">
        {signup ? "Already have an account? " : "New to Bez Bot? "}
        <Link className="text-white underline underline-offset-2" href={other} replace>
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
