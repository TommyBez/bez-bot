import Link from "next/link";
import { BezLogo } from "@/components/bez/bot-avatar";

const MENUS: { label: string; items: { label: string; href: string; description?: string }[] }[] = [
  {
    label: "Products",
    items: [
      { label: "Bez Bot", href: "/", description: "AI teammates that finish the work" },
      { label: "Marketplace", href: "/marketplace", description: "Hire a Bot for any job" },
      { label: "Download", href: "/download", description: "Desktop, web, and mobile" },
    ],
  },
  {
    label: "Solutions",
    items: [
      { label: "Sales & GTM", href: "/guides/gtm" },
      { label: "Product teams", href: "/guides/product" },
      { label: "Design teams", href: "/guides/design" },
      { label: "Operations", href: "/guides/operations" },
    ],
  },
  {
    label: "Developer",
    items: [
      { label: "Built with eve", href: "https://eve.dev/docs", description: "The agent framework under the hood" },
      { label: "Source", href: "https://github.com/TommyBez/bez-bot" },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "About", href: "/guides" },
      { label: "Launch post", href: "/guides/introducing-bez-bot" },
    ],
  },
];

export function MarketingNav({ signedIn }: { readonly signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <Link aria-label="Bez Bot home" href="/">
            <BezLogo className="text-[15px]" />
          </Link>
          <ul className="hidden items-center gap-1 text-[14px] text-neutral-400 lg:flex">
            {MENUS.map((menu) => (
              <li className="group relative" key={menu.label}>
                <button className="rounded-full px-3 py-1.5 transition-colors hover:text-white" type="button">
                  {menu.label}
                </button>
                <div className="pointer-events-none absolute top-full left-0 pt-2 opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
                  <div className="w-64 rounded-2xl border border-white/10 bg-neutral-950/95 p-2 shadow-2xl backdrop-blur">
                    {menu.items.map((item) => (
                      <Link className="block rounded-xl px-3 py-2 hover:bg-white/[0.06]" href={item.href} key={item.label}>
                        <span className="block text-[14px] text-white">{item.label}</span>
                        {item.description ? <span className="block text-[12.5px] text-neutral-500">{item.description}</span> : null}
                      </Link>
                    ))}
                  </div>
                </div>
              </li>
            ))}
            <li>
              <Link className="rounded-full px-3 py-1.5 transition-colors hover:text-white" href="/#pricing">
                Pricing
              </Link>
            </li>
            <li>
              <Link className="rounded-full px-3 py-1.5 transition-colors hover:text-white" href="/guides">
                News
              </Link>
            </li>
          </ul>
        </div>
        <div className="flex items-center gap-2">
          <Link
            className="hidden rounded-full px-4 py-2 text-[14px] text-neutral-300 transition-colors hover:text-white sm:inline-flex"
            href="mailto:sales@bezbot.dev"
          >
            Contact Sales
          </Link>
          {signedIn ? null : (
            <Link className="rounded-full px-3 py-2 text-[14px] text-neutral-300 transition-colors hover:text-white" href="/login">
              Sign in
            </Link>
          )}
          <Link
            className="inline-flex h-9 items-center rounded-full bg-white px-4 text-[14px] font-medium text-black transition-colors hover:bg-neutral-200"
            href={signedIn ? "/app" : "/login?mode=signup"}
          >
            {signedIn ? "Open app" : "Get started"}
          </Link>
        </div>
      </nav>
    </header>
  );
}
