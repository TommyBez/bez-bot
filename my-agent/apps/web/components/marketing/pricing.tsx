"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Tier {
  id: string;
  label: string;
  price: number;
  cta: string;
}

interface Plan {
  group: string;
  unit: string;
  tiers: Tier[];
  lead?: Record<string, string>;
  features: Record<string, string[]>;
}

const PLANS: Plan[] = [
  {
    group: "Bez",
    unit: "/ month",
    tiers: [
      { id: "pro", label: "Pro", price: 20, cta: "Get Pro" },
      { id: "pro_plus", label: "Pro+", price: 60, cta: "Get Pro+" },
      { id: "ultra", label: "Ultra", price: 200, cta: "Get Ultra" },
    ],
    features: {
      pro: ["Bez Bot's own computer", "Signs into your tools", "Routines on a schedule", "Work anywhere: desktop, mobile, and more", "Weekly Bez Bot usage included"],
      pro_plus: ["Bez Bot's own computer", "Signs into your tools", "Routines on a schedule", "Work anywhere: desktop, mobile, and more", "3× weekly Bez Bot usage"],
      ultra: ["Bez Bot's own computer", "Signs into your tools", "Routines on a schedule", "Work anywhere: desktop, mobile, and more", "Extended limits on AI tokens"],
    },
  },
  {
    group: "Bez Max",
    unit: "/ month",
    tiers: [
      { id: "max", label: "Max", price: 30, cta: "Get Max" },
      { id: "plus", label: "Plus", price: 60, cta: "Get Plus" },
      { id: "heavy", label: "Heavy", price: 300, cta: "Get Heavy" },
    ],
    lead: { max: "Includes:", plus: "Everything in Max, plus:", heavy: "Everything in Max, plus:" },
    features: {
      max: ["Bez Bot access", "Grok 4.7 model", "Higher rate limits across all features", "Image and video generation", "Connectors"],
      plus: ["Significantly higher usage across Chat, Build, and Bots", "Lightning-fast replies", "Priority access at peak times", "Early access to new features"],
      heavy: ["Highest usage at the fastest speed", "Solve extremely hard problems", "Most powerful intelligence", "Dedicated support & early access"],
    },
  },
  {
    group: "Bez Teams",
    unit: "/ seat / month",
    tiers: [
      { id: "standard", label: "Standard", price: 40, cta: "Get Standard" },
      { id: "premium", label: "Premium", price: 80, cta: "Get Premium" },
    ],
    lead: { standard: "Everything in Pro+, plus:", premium: "Everything in Ultra, plus:" },
    features: {
      standard: ["Centralized team billing and settings", "Team marketplace for skills and plugins", "Shared usage analytics"],
      premium: ["Centralized team billing and settings", "Team marketplace for skills and plugins", "Shared usage analytics", "SAML/OIDC SSO"],
    },
  },
];

function PlanCard({ plan }: { readonly plan: Plan }) {
  const [tierId, setTierId] = useState(plan.tiers[0]!.id);
  const tier = plan.tiers.find((t) => t.id === tierId) ?? plan.tiers[0]!;
  return (
    <div className="flex flex-col rounded-[28px] border border-white/10 bg-[#0a0a0b] p-7">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-[15px] font-medium text-white">{plan.group}</span>
        <div className="flex rounded-full border border-white/10 p-0.5">
          {plan.tiers.map((t) => (
            <button
              className={cn(
                "rounded-full px-3 py-1 text-[12.5px] transition-colors",
                t.id === tierId ? "bg-white text-black" : "text-neutral-400 hover:text-white",
              )}
              key={t.id}
              onClick={() => setTierId(t.id)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-5xl font-medium tracking-tight text-white tabular-nums transition-all">${tier.price}</span>
        <span className="text-[14px] text-neutral-500">{plan.unit}</span>
      </div>
      <div className="mb-6 text-[13px] text-neutral-500">Billed monthly</div>
      <Link
        className="mb-7 inline-flex h-11 items-center justify-center rounded-full bg-white text-[14px] font-medium text-black hover:bg-neutral-200"
        href="/login?mode=signup"
      >
        {tier.cta}
      </Link>
      <div className="mb-3 text-[13px] text-neutral-400">{plan.lead?.[tier.id] ?? "Includes:"}</div>
      <ul className="space-y-2.5">
        {plan.features[tier.id]!.map((feature) => (
          <li className="flex items-start gap-2.5 text-[14px] text-neutral-300" key={feature}>
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-neutral-500" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Pricing() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.group} plan={plan} />
        ))}
      </div>
      <div className="flex flex-col items-center justify-between gap-4 rounded-[24px] border border-white/10 px-7 py-5 sm:flex-row">
        <p className="text-[14.5px] text-neutral-300">
          Already on an eligible plan? <span className="text-white">Bez Bot is included.</span>
        </p>
        <Link className="rounded-full border border-white/15 px-4 py-2 text-[13.5px] text-white hover:bg-white/[0.06]" href="/login">
          Sign in with your plan
        </Link>
      </div>
    </div>
  );
}
