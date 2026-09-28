export interface Guide {
  slug: string;
  title: string;
  summary: string;
  audience: string;
  minutes: number;
  sections: { heading: string; body: string[]; bullets?: string[] }[];
}

export const GUIDES: Guide[] = [
  {
    slug: "introducing-bez-bot",
    title: "Introducing Bez Bot",
    summary: "AI teammates with their own computer, memory, and the ability to work with each other.",
    audience: "Launch post",
    minutes: 4,
    sections: [
      {
        heading: "Teammates, not assistants",
        body: [
          "Most AI tools wait for you to type and hand back text. Bez Bot gives you teammates that take a job and finish it. Each Bot has a role, its own computer, a memory of how you work, and routines it runs on its own.",
          "You message a Bot the way you would message a colleague. It plans, does the work in its own browser and terminal, and comes back with finished output—files, drafts, tickets, reports—and only asks when it needs your decision.",
        ],
      },
      {
        heading: "Bots that talk to each other",
        body: [
          "The biggest change is that Bots coordinate among themselves. A Chief of Staff Bot can ask Research for data, loop in Comms for the announcement, and ping Travel for bookings—in parallel—then merge the results.",
          "Every bot-to-bot message is a durable request: the teammate works in its own session on the shared computer, and its reply wakes the requester so the work keeps moving while you are away. You can watch every exchange live in the Network view.",
        ],
      },
      {
        heading: "Show it once, it runs forever",
        body: [
          "Teach a task by recording your screen while you do it. The Bot watches, writes the procedure as a routine, and runs it on a schedule from then on. Routines report to your inbox, and anything that needs approval waits for you.",
        ],
      },
      {
        heading: "Under the hood",
        body: [
          "Bez Bot is built on eve, Vercel's framework for durable agents. Every conversation is a durable session that survives restarts and deploys; bot-to-bot handoffs are durable workflow tools; approvals and questions park the session until you answer; and schedules dispatch routines every minute.",
        ],
      },
    ],
  },
  {
    slug: "gtm",
    title: "Bez Bot for GTM teams",
    summary: "Run outbound, account health, and renewals with a team of Bots that share context.",
    audience: "Sales & GTM",
    minutes: 6,
    sections: [
      {
        heading: "Start with two Bots",
        body: ["Hire Sales Outbound and Account Health from the marketplace. Tell each one your ICP, exclusions, and who approves discounts; they save it to memory."],
        bullets: [
          "Sales Outbound builds lists overnight and leaves drafts for review.",
          "Account Health flags churn risk with evidence every Tuesday.",
          "They message each other so outbound never cold-emails an existing customer.",
        ],
      },
      {
        heading: "Keep humans on the send button",
        body: ["Leave Auto Review on. Drafting, research, and CRM reads run freely; sending email, changing deal stages, or offering discounts waits for your approval in the inbox."],
      },
    ],
  },
  {
    slug: "product",
    title: "Bez Bot for product teams",
    summary: "Morning metric briefs, regression triage, and bug repros before standup.",
    audience: "Product",
    minutes: 5,
    sections: [
      {
        heading: "A metrics brief every morning",
        body: ["Product Performance pulls yesterday's numbers, explains changes by segment, and writes a brief to the shared drive before standup."],
      },
      {
        heading: "Regression → repro in one hop",
        body: ["When a metric drops, Product Performance messages Bug Reproduction with the evidence. Bug Reproduction reproduces the issue in its own browser, files a ticket, and the reply lands back in the brief."],
      },
    ],
  },
  {
    slug: "design",
    title: "Bez Bot for designers",
    summary: "Research, competitive teardown, and asset prep that runs while you design.",
    audience: "Design",
    minutes: 4,
    sections: [
      {
        heading: "Competitive teardowns on autopilot",
        body: ["Ask Research to screenshot and annotate competitors' onboarding flows every month. It saves images and notes to the shared drive so every Bot—and you—can reuse them."],
      },
      {
        heading: "Copy that fits the frame",
        body: ["Loop in Comms from a design thread to draft microcopy variants in your brand voice, with character limits you set once in team memory."],
      },
    ],
  },
  {
    slug: "operations",
    title: "Bez Bot for operations",
    summary: "Close the books, plan travel, and run the weekly operating rhythm.",
    audience: "Operations",
    minutes: 5,
    sections: [
      {
        heading: "The Chief of Staff pattern",
        body: ["A Chief of Staff Bot collects updates from every other Bot on Monday morning, writes the weekly brief, and lists the decisions it needs from you. It runs as a routine, so it happens even when you forget."],
      },
      {
        heading: "Money moves wait for you",
        body: ["Expense Manager reconciles and codes transactions on its own, but payments, refunds, and submissions to accounting always require approval, even with Auto Review on."],
      },
    ],
  },
  {
    slug: "use-cases",
    title: "Use cases",
    summary: "Twenty jobs teams hand to Bez Bot today.",
    audience: "Use cases",
    minutes: 3,
    sections: [
      {
        heading: "What teams hand off",
        body: ["A sampling of routines running on Bez Bot today:"],
        bullets: [
          "Nightly prospect research and draft outreach",
          "Weekly churn-risk review with save plays",
          "Morning product metrics brief",
          "Bug report triage and reproduction",
          "Month-end expense reconciliation",
          "Support queue sweeps with escalation summaries",
          "Release notes and launch posts from the changelog",
          "Candidate sourcing against a role scorecard",
          "Team offsite planning across agenda, comms, and travel",
          "Monday operating brief from every Bot",
        ],
      },
    ],
  },
  {
    slug: "security",
    title: "Security, privacy, and terms",
    summary: "How Bez Bot isolates computers, protects logins, and keeps you in control.",
    audience: "Trust",
    minutes: 4,
    sections: [
      {
        heading: "Isolation",
        body: ["Each Bot session runs in an isolated sandbox. Your Bots share one persistent drive that is private to you. Teammate Bots work on the requester's computer, never another user's."],
      },
      {
        heading: "Logins",
        body: ["Saved logins are encrypted with AES-256-GCM. When a Bot signs in, the password is passed to the computer as a process variable and typed directly; it never appears in the model's context, tool results, or logs."],
      },
      {
        heading: "Auto Review and approvals",
        body: ["Per Bot, choose Auto Review (a reviewer model decides when to ask), Always ask, or Off. Destructive actions like deleting routines always ask. Scheduled runs cannot wait for approval, so they leave those actions for you."],
      },
      {
        heading: "Privacy",
        body: ["Your conversations, memory, and files are yours. Delete a Bot and its memory and routines are deleted with it."],
      },
      {
        heading: "Terms",
        body: ["Bez Bot is a demonstration product that clones the structure of Grok Bot. It is not affiliated with xAI or SpaceXAI. Bots are AI systems and can make mistakes; review important work before relying on it."],
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
