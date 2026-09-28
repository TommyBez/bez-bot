import Link from "next/link";
import { redirect } from "next/navigation";
import { BezLogo } from "@/components/bez/bot-avatar";
import { authErrorMessage } from "@/lib/auth-form";
import { safeRedirectPath } from "@/lib/redirect";
import { currentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export async function generateMetadata({ searchParams }: { readonly searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return { title: mode === "signup" ? "Create account" : "Sign in" };
}

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string; mode?: string; error?: string }>;
}) {
  const { next, mode, error } = await searchParams;
  const safeNext = safeRedirectPath(next);
  const signup = mode === "signup";
  if (await currentUser()) redirect(safeNext);
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-black px-5">
      <div className="grid-fade pointer-events-none absolute inset-0" />
      <div className="glow pointer-events-none absolute inset-x-0 top-0 h-[500px]" />
      <div className="relative w-full max-w-sm space-y-8">
        <Link className="flex justify-center" href="/">
          <BezLogo className="text-lg" />
        </Link>
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-medium tracking-tight text-white">{signup ? "Meet your first Bot" : "Welcome back"}</h1>
          <p className="text-[15px] text-neutral-400">
            {signup ? "Create an account for your team of AI teammates." : "Sign in to your team of AI teammates."}
          </p>
        </div>
        <LoginForm initialError={authErrorMessage(error)} key={signup ? "signup" : "signin"} mode={signup ? "signup" : "signin"} next={safeNext} />
        <p className="text-center text-[12.5px] text-neutral-600">
          By continuing you agree to the{" "}
          <Link className="underline underline-offset-2" href="/guides/security#terms">
            terms
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
