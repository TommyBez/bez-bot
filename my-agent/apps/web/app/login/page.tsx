import Link from "next/link";
import { redirect } from "next/navigation";
import { BezLogo } from "@/components/bez/bot-avatar";
import { currentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { readonly searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
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
          <h1 className="text-3xl font-medium tracking-tight text-white">Meet your first Bot</h1>
          <p className="text-[15px] text-neutral-400">Sign in to your team of AI teammates.</p>
        </div>
        <LoginForm next={safeNext} />
        <p className="text-center text-[12.5px] text-neutral-600">
          Demo sign-in: your email identifies your workspace. By continuing you agree to the{" "}
          <Link className="underline underline-offset-2" href="/guides/security#terms">
            terms
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
