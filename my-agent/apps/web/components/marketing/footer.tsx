import Link from "next/link";
import { BezLogo } from "@/components/bez/bot-avatar";
import { BRAND } from "@shared/brand";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Products",
    links: [
      { label: "Bez Bot", href: "/" },
      { label: "Web app", href: "/app" },
      { label: "Download", href: "/download" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Bez Bot",
    links: [
      { label: "Overview", href: "/" },
      { label: "Marketplace", href: "/marketplace" },
      { label: "Guides", href: "/guides" },
      { label: "Use cases", href: "/guides/use-cases" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Sales & GTM", href: "/guides/gtm" },
      { label: "Product", href: "/guides/product" },
      { label: "Design", href: "/guides/design" },
      { label: "Operations", href: "/guides/operations" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "eve docs", href: "https://eve.dev/docs" },
      { label: "Source code", href: "https://github.com/TommyBez/bez-bot" },
      { label: "Status", href: "/eve/v1/health" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/guides" },
      { label: "News", href: "/guides/introducing-bez-bot" },
      { label: "Contact", href: "mailto:hello@bezbot.dev" },
    ],
  },
  {
    title: "Trust",
    links: [
      { label: "Security", href: "/guides/security" },
      { label: "Privacy", href: "/guides/security#privacy" },
      { label: "Terms", href: "/guides/security#terms" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-black">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.2fr_3fr]">
        <div className="space-y-4">
          <BezLogo className="text-[15px]" />
          <p className="max-w-xs text-sm text-neutral-500">{BRAND.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="mb-3 text-[13px] font-medium text-neutral-300">{column.title}</h3>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link className="text-[13px] text-neutral-500 transition-colors hover:text-white" href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-white/[0.06] px-5 py-6 text-[12.5px] text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>© 2026 {BRAND.company}</span>
        <span>
          {BRAND.poweredBy} · A Grok Bot–style product clone. Not affiliated with xAI.
        </span>
      </div>
    </footer>
  );
}
