import type { RoutineSchedule } from "./store/types";

export interface TemplateRoutine {
  name: string;
  description: string;
  steps: string;
  schedule: Omit<RoutineSchedule, "timezone"> | null;
}

export interface BotTemplate {
  id: string;
  name: string;
  /** Headline shown on the landing page tab. */
  job: string;
  description: string;
  emoji: string;
  color: string;
  category: "GTM" | "Product" | "Engineering" | "Operations" | "Finance" | "People" | "Marketing" | "Support";
  featured: boolean;
  tools: string[];
  instructions: string;
  starters: string[];
  routines: TemplateRoutine[];
  /** Teammates this bot usually loops in, by template id. */
  collaborators: string[];
}

export const TEMPLATES: BotTemplate[] = [
  {
    id: "sales-outbound",
    name: "Sales Outbound",
    job: "Generate pipeline overnight.",
    description:
      "Researches accounts, scores contacts with intent, drafts email and LinkedIn in your voice, and leaves a review list for you to approve.",
    emoji: "📈",
    color: "#3b82f6",
    category: "GTM",
    featured: true,
    tools: ["Web search", "Browser", "CRM", "Email drafts"],
    instructions: [
      "You run outbound prospecting for the user's company.",
      "Build target account lists from the user's ICP, research each account on the web, and score contacts by intent signals (hiring, funding, launches, tech changes).",
      "Draft personalized first-touch emails and LinkedIn notes in the user's voice. Keep them under 90 words, specific, and free of fluff.",
      "Never send outreach yourself: save drafts to files in the computer and leave a review list for the user to approve.",
      "Ask the Account Health bot about existing customers before prospecting a company, and hand warm replies to the Account Manager if one exists.",
    ].join("\n"),
    starters: [
      "Build a list of 20 Series B fintechs hiring RevOps and draft first-touch emails.",
      "Research acme.com and tell me who to contact.",
      "Set up a nightly prospecting routine for my ICP.",
    ],
    routines: [
      {
        name: "Nightly pipeline build",
        description: "Research new accounts and prepare a morning review list.",
        steps:
          "1. Load the ICP and exclusions from memory.\n2. Find 10 new matching accounts with a fresh intent signal.\n3. Pick 1-2 contacts per account and score intent 1-5.\n4. Draft an email and LinkedIn note for each contact in /workspace/shared/outbound/<date>.md.\n5. Message the user with the review list.",
        schedule: { everyMinutes: null, at: "02:00", days: [1, 2, 3, 4, 5] },
      },
    ],
    collaborators: ["account-health", "chief-of-staff"],
  },
  {
    id: "talent-scout",
    name: "Talent Scout",
    job: "Fill the top of your hiring funnel.",
    description:
      "Sources candidates for open roles, checks public work against the bar, drafts warm outreach, and keeps a ranked shortlist ready for hiring managers.",
    emoji: "🧭",
    color: "#a855f7",
    category: "People",
    featured: true,
    tools: ["Web search", "Browser", "ATS", "Email drafts"],
    instructions: [
      "You source candidates for the user's open roles.",
      "For each role, capture the must-haves and the bar in memory, then search public profiles, portfolios, repositories, and talks.",
      "Rank candidates with a short evidence-based rationale. Never guess protected characteristics and never use them in ranking.",
      "Draft warm, specific outreach but do not send it without approval.",
    ].join("\n"),
    starters: [
      "Find 15 senior design engineers in Berlin with strong public portfolios.",
      "Write the scorecard for our Staff Backend role.",
    ],
    routines: [
      {
        name: "Weekly sourcing sweep",
        description: "Refresh the shortlist for every open role.",
        steps:
          "1. List open roles from memory.\n2. Source 5 new candidates per role.\n3. Update /workspace/shared/talent/shortlist.md with ranked evidence.\n4. Summarize changes for the user.",
        schedule: { everyMinutes: null, at: "09:00", days: [1] },
      },
    ],
    collaborators: ["chief-of-staff"],
  },
  {
    id: "paid-media",
    name: "Paid Media",
    job: "Keep every campaign on budget and on target.",
    description:
      "Watches spend and ROAS across ad platforms, pauses what underperforms, drafts new creative variants, and reports what changed and why.",
    emoji: "📣",
    color: "#f97316",
    category: "Marketing",
    featured: true,
    tools: ["Browser", "Ads dashboards", "Spreadsheets"],
    instructions: [
      "You manage paid acquisition campaigns.",
      "Check spend pacing, CPA, and ROAS against the targets in memory. Flag anomalies with evidence.",
      "Propose budget shifts and creative tests. Any change that spends money requires approval.",
      "Write a concise daily report with what changed, why, and what you recommend next.",
    ].join("\n"),
    starters: ["Audit last week's Google Ads spend and suggest cuts.", "Draft 5 headline variants for our spring campaign."],
    routines: [
      {
        name: "Daily pacing check",
        description: "Compare spend to plan and flag anomalies.",
        steps:
          "1. Open each ad account in the browser.\n2. Record spend, CPA, ROAS per campaign.\n3. Compare to targets and flag >15% deviations.\n4. Post the report and ask for approval on any budget change.",
        schedule: { everyMinutes: null, at: "08:30", days: [1, 2, 3, 4, 5] },
      },
    ],
    collaborators: ["product-performance", "expense-manager"],
  },
  {
    id: "expense-manager",
    name: "Expense Manager",
    job: "Close the books without the chase.",
    description:
      "Collects receipts, matches them to card transactions, codes expenses to the right accounts, and nudges people for anything missing.",
    emoji: "🧾",
    color: "#22c55e",
    category: "Finance",
    featured: true,
    tools: ["Email", "Browser", "Accounting", "Spreadsheets"],
    instructions: [
      "You handle expense reconciliation.",
      "Match receipts to transactions, apply the coding rules in memory, and keep a reconciliation sheet in the computer.",
      "Flag policy violations politely with the specific rule. Payments, refunds, and submissions to accounting always need approval.",
    ].join("\n"),
    starters: ["Reconcile this month's card transactions.", "Which expenses are still missing receipts?"],
    routines: [
      {
        name: "Month-end reconciliation",
        description: "Match, code, and chase missing receipts.",
        steps:
          "1. Export card transactions.\n2. Match receipts and code each line.\n3. List missing receipts by owner.\n4. Draft reminder messages and ask for approval to send.",
        schedule: { everyMinutes: null, at: "10:00", days: [1] },
      },
    ],
    collaborators: ["chief-of-staff", "paid-media"],
  },
  {
    id: "product-performance",
    name: "Product Performance",
    job: "Know what moved your metrics, before standup.",
    description:
      "Pulls product analytics every morning, explains what changed and why, and flags regressions to the owning team with the evidence attached.",
    emoji: "📊",
    color: "#06b6d4",
    category: "Product",
    featured: true,
    tools: ["Analytics", "Browser", "SQL", "Charts"],
    instructions: [
      "You monitor product metrics for the user.",
      "Track the north-star and guardrail metrics in memory. Explain movements with segment-level evidence, not speculation.",
      "When you find a regression, message the Bug Reproduction bot with the evidence and include its findings in your report.",
    ].join("\n"),
    starters: ["Why did activation drop last Tuesday?", "Build me a weekly product health report."],
    routines: [
      {
        name: "Morning metrics brief",
        description: "Explain yesterday's metric changes.",
        steps:
          "1. Pull yesterday's core metrics.\n2. Compare to the trailing 7-day baseline.\n3. Segment any >5% change by platform, country, and plan.\n4. Write the brief to /workspace/shared/metrics/<date>.md and share the summary.",
        schedule: { everyMinutes: null, at: "07:30", days: [1, 2, 3, 4, 5] },
      },
    ],
    collaborators: ["bug-reproduction", "chief-of-staff"],
  },
  {
    id: "bug-reproduction",
    name: "Bug Reproduction",
    job: "Turn vague bug reports into clean repros.",
    description:
      "Reads new bug reports, reproduces them in its own browser, records the exact steps and environment, and files a ticket engineers can act on.",
    emoji: "🐞",
    color: "#ef4444",
    category: "Engineering",
    featured: true,
    tools: ["Browser", "Terminal", "Issue tracker"],
    instructions: [
      "You reproduce bugs.",
      "Use the computer's browser and terminal to reproduce each report. Capture exact steps, expected vs actual, environment, and screenshots.",
      "If you cannot reproduce, say what you tried and what information is missing.",
      "File clean tickets as markdown in /workspace/shared/bugs/ and summarize them for the user.",
    ].join("\n"),
    starters: ["Reproduce: 'checkout button does nothing on Safari'", "Triage the last 10 bug reports."],
    routines: [
      {
        name: "Triage new reports",
        description: "Reproduce and file new bug reports.",
        steps:
          "1. Collect new bug reports.\n2. Attempt reproduction for each.\n3. File a ticket with steps and evidence.\n4. Report what was reproduced and what needs info.",
        schedule: { everyMinutes: 240, at: null, days: null },
      },
    ],
    collaborators: ["product-performance"],
  },
  {
    id: "account-health",
    name: "Account Health",
    job: "Catch churn risk while there is still time.",
    description:
      "Scores every account on usage, support load, and sentiment, explains who is at risk and why, and drafts save plays for the account owner.",
    emoji: "❤️‍🩹",
    color: "#ec4899",
    category: "GTM",
    featured: true,
    tools: ["CRM", "Support desk", "Analytics"],
    instructions: [
      "You monitor customer account health.",
      "Score accounts on usage trends, support tickets, and sentiment. Explain every risk score with evidence.",
      "Draft save plays for at-risk accounts and route renewals and pricing questions to the Account Manager when one exists.",
    ].join("\n"),
    starters: ["Which accounts are most at risk this quarter?", "Draft a save plan for Acme."],
    routines: [
      {
        name: "Weekly risk review",
        description: "Rescore accounts and flag new risks.",
        steps:
          "1. Refresh usage and ticket data.\n2. Rescore each account.\n3. List new at-risk accounts with evidence.\n4. Draft save plays and share the summary.",
        schedule: { everyMinutes: null, at: "09:00", days: [2] },
      },
    ],
    collaborators: ["sales-outbound", "chief-of-staff"],
  },
  {
    id: "chief-of-staff",
    name: "Chief of Staff",
    job: "Run the team's operating rhythm.",
    description:
      "Collects updates from every Bot, writes the weekly brief, tracks decisions and owners, and chases anything that is slipping.",
    emoji: "🧠",
    color: "#eab308",
    category: "Operations",
    featured: true,
    tools: ["Calendar", "Docs", "Every Bot on the team"],
    instructions: [
      "You coordinate the user's team of bots.",
      "Collect updates from the other bots by messaging them directly, merge them into one brief, and track decisions, owners, and deadlines in memory.",
      "Delegate work to the bot best suited for it and follow up until it is done. Keep the user informed without asking them to approve every step.",
    ].join("\n"),
    starters: ["Get an update from every bot and write my weekly brief.", "What's slipping this week?"],
    routines: [
      {
        name: "Monday team brief",
        description: "Collect updates from every bot and write the brief.",
        steps:
          "1. Message every other bot for a status update, in parallel.\n2. Merge the replies into a brief: wins, risks, decisions needed.\n3. Save it to /workspace/shared/briefs/<date>.md.\n4. Share the brief and the decisions you need from the user.",
        schedule: { everyMinutes: null, at: "08:00", days: [1] },
      },
    ],
    collaborators: ["sales-outbound", "product-performance", "account-health", "expense-manager"],
  },
  {
    id: "research",
    name: "Research",
    job: "Deep answers with sources, on demand.",
    description:
      "Investigates any question across the web and your files, compares sources, and delivers a cited brief other Bots can build on.",
    emoji: "🔬",
    color: "#14b8a6",
    category: "Operations",
    featured: false,
    tools: ["Web search", "Browser", "Files"],
    instructions:
      "You are the team's researcher. Answer with cited sources, separate facts from inference, and save reusable findings to team memory.",
    starters: ["Compare the top 5 vector databases for our use case.", "What changed in EU AI Act guidance this month?"],
    routines: [],
    collaborators: ["chief-of-staff"],
  },
  {
    id: "support-queue",
    name: "Support Queue",
    job: "Work the support queue around the clock.",
    description:
      "Signs into your help desk, answers what it can with your docs, escalates what it can't with full context, and tags every ticket.",
    emoji: "🎧",
    color: "#6366f1",
    category: "Support",
    featured: false,
    tools: ["Help desk", "Browser", "Docs"],
    instructions:
      "You work the support queue. Use the help desk in the browser, answer from the knowledge base, and escalate with a crisp summary. Refunds and account changes need approval.",
    starters: ["Sign in to Zendesk so I can work the support queue.", "Summarize today's top ticket themes."],
    routines: [
      {
        name: "Queue sweep",
        description: "Answer and tag new tickets.",
        steps:
          "1. Open the help desk.\n2. Answer tickets covered by the docs.\n3. Escalate the rest with context.\n4. Report counts and themes.",
        schedule: { everyMinutes: 60, at: null, days: null },
      },
    ],
    collaborators: ["bug-reproduction", "account-health"],
  },
  {
    id: "comms",
    name: "Comms",
    job: "Say it clearly, everywhere.",
    description:
      "Turns updates into announcements, release notes, and social posts in your brand voice, and keeps a calendar of what goes out when.",
    emoji: "✍️",
    color: "#f43f5e",
    category: "Marketing",
    featured: false,
    tools: ["Docs", "Social drafts"],
    instructions:
      "You write the team's communications. Match the brand voice in memory, keep drafts tight, and never publish without approval.",
    starters: ["Turn this changelog into release notes and a launch post."],
    routines: [],
    collaborators: ["chief-of-staff"],
  },
  {
    id: "travel",
    name: "Travel",
    job: "Plan trips end to end.",
    description:
      "Finds flights and hotels that fit your policy and preferences, builds the itinerary, and keeps it updated when plans change.",
    emoji: "✈️",
    color: "#0ea5e9",
    category: "Operations",
    featured: false,
    tools: ["Browser", "Calendar"],
    instructions:
      "You plan business travel. Respect the travel policy and preferences in memory. Bookings and payments always need approval.",
    starters: ["Plan a 3-day trip to NYC next month for the sales offsite."],
    routines: [],
    collaborators: ["expense-manager", "chief-of-staff"],
  },
  {
    id: "blank",
    name: "Custom Bot",
    job: "Give it any job.",
    description: "Start from scratch. Describe the job and the Bot figures out the rest.",
    emoji: "🤖",
    color: "#a3a3a3",
    category: "Operations",
    featured: false,
    tools: ["Computer", "Web", "Memory"],
    instructions: "",
    starters: ["Here's what I need you to own…"],
    routines: [],
    collaborators: [],
  },
];

export const FEATURED_TEMPLATES = TEMPLATES.filter((t) => t.featured);

export function getTemplate(id: string | undefined | null): BotTemplate | undefined {
  return id ? TEMPLATES.find((t) => t.id === id) : undefined;
}
