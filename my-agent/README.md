# Bez Bot

AI teammates that own a job end to end. Each bot has its own computer, remembers how you like things done, runs routines on a schedule, and messages the other bots to get work done without you in the loop.

Bez Bot is a working clone of the [x.ai/bot](https://x.ai/bot) product built on [eve](https://eve.dev). It is not affiliated with xAI.

- **Marketing site**: landing page, jobs, pricing, download, guides, FAQ, and a marketplace of bot templates.
- **App** (`/app`): create bots from templates, DM them, run threads with several bots at once, teach a bot by recording your screen, review approvals, and watch bots talk to each other.

## What's in the box

| Feature | How it works |
| --- | --- |
| Bots with a job | 13 templates in `lib/templates.ts` (Sales Outbound, Research, Chief of Staff, Support Queue…). Each has a job, instructions, starters, routines, and suggested collaborators. |
| Own computer | Each user gets a sandbox with `/workspace/shared` (synced to blob storage between sessions) and an optional Linux desktop driven by eve's `computer_use`. The Computer page shows files, a live screenshot, and an activity log. |
| DMs and tasks | Every bot conversation is a durable eve session. Tasks resume where they left off, even days later. |
| Threads | Several bots in one conversation. The lead bot fans work out to the others in parallel and combines their answers. |
| **Autonomous bot-to-bot messaging** | `message_bot` hands work to a teammate. The teammate runs as its own session with its own persona, memory, and tools, and its reply wakes the sender. Bots do this on their own during tasks and scheduled routines. See [Bot network](#bot-network). |
| Memory | Per-bot and team memory (`remember` / `forget`), editable on the Memory page, injected into every turn. |
| Routines | Schedules like daily at 08:00 or every 30 minutes, in the user's timezone. One eve schedule dispatches all due routines each minute, and each run is its own session with a transcript. |
| Teach mode | Record your screen (frames and narration) or describe the steps, and the bot turns them into a saved routine. |
| Auto Review | Risky shell commands and logins go through an approval policy: an automatic reviewer model, always ask, or trust. Destructive actions always ask. In unattended routines, anything that would need a person is denied with a reason. |
| Logins | An AES-256-GCM vault. `use_login` types credentials into the desktop without the model ever seeing the password. |
| Inbox | Approvals, questions, routine results, and bot-to-bot replies. |
| Sharing | Publish a bot as a `/b/<id>` link that other users can add to their team. |

## Bot network

Autonomous communication between bots is built from eve primitives:

1. **`message_bot`** (`agent/lib/tools/message_bot.ts`) is a background workflow tool. A durable step validates the handoff: the teammate exists, the sender may message it (`allowedPeers`), the sender is allowed to start conversations on its own (`autonomous`), the depth limit, and an hourly budget. It then records the request and builds the teammate's persona.
2. The tool calls the declared **`teammate` subagent** (`agent/subagents/teammate/`) with `ctx.agent(...)`. The message carries an HMAC-signed envelope (`<bezbot-teammate …/>`) plus the target bot's persona, so the child session knows which bot it is from its first turn. Envelopes without a valid signature are ignored.
3. The teammate works on the **same shared computer**. Files it writes under `/workspace/shared` are visible to the sender. It can message a third bot (depth limit 2).
4. The call returns right away. When the teammate finishes, eve delivers the result as a **background task result that wakes the sender**, which continues without the user. Passing `conversationId` continues the same teammate session later.
5. Every exchange is logged. The **Bot network** page (`/app/network`) shows who asked whom, the replies, and a "Watch" link into the teammate's live session.

Scheduled routines use the same path. For example, the Chief of Staff's "Monday team brief" messages every other bot, collects their updates, and posts the brief to your inbox.

## Architecture

```
apps/web (Next.js 16)                 agent/ (eve)
├─ marketing pages                    ├─ agent.ts            defineAgent (model, compaction, limits)
├─ /app UI  ── useEveAgent ──────────▶ ├─ channels/eve.ts      cookie auth + ownership checks
│   (same-origin /eve/v1/**)          ├─ channels/routines.ts headless channel for routine runs
├─ /api/* (bots, routines, memory,    ├─ schedules/dispatch.ts every minute: claim due routines
│   inbox, network, computer, vault)  ├─ instructions/        base rules + dynamic persona per turn
└─ withEve() proxies /eve/v1/**       ├─ tools/               memory, routines, bash, computer, logins, message_bot
                                      ├─ hooks/               session registry, bot status, drive sync
lib/ (shared by both)                 ├─ sandbox.ts           Vercel Sandbox (desktop) or local sandbox
├─ store/ KV (Upstash Redis | files)  └─ subagents/teammate/  the bot-to-bot recipient (nested one level)
├─ store/ blobs (Vercel Blob | files)
├─ auth.ts, protocol.ts, persona.ts, templates.ts, schedule.ts
```

- **Identity.** The web app signs a `bezbot_session` cookie. The eve channel verifies it, checks that the bot, thread, or session belongs to the user, and pins the result on the session as `auth.initiator`. Hooks write a session registry (`sessionId → user, bot, mode`) that tools, the sandbox, and route auth read.
- **Persona.** One agent definition serves every bot. `instructions/persona.ts` resolves the bot, its teammates, memory, and routines for each turn.
- **Storage.** Upstash Redis and private Vercel Blob in production. Local files under `.data/` otherwise.

## Run it locally

Requires Node 24 and pnpm.

```bash
pnpm install
BEZBOT_DEMO_MODEL=1 pnpm dev      # scripted offline model, no credentials needed
```

Open http://localhost:3000, sign in with any email, and create a couple of bots (for example Sales Outbound and Research). Then ask Sales Outbound: "Ask Research for the top 5 fintechs hiring RevOps, then draft emails."

`BEZBOT_DEMO_MODEL=1` swaps in a scripted model (`agent/lib/demo-brain.ts`). It exercises every tool path: handoffs, parallel fan-out in threads, memory, routines, and approvals. To use a real model instead, run `eve link` to connect a Vercel project with AI Gateway access (or set `AI_GATEWAY_API_KEY`), then run `pnpm dev`. The model is set in `agent/lib/model.ts`.

In development, a ticker in `apps/web/instrumentation.ts` fires the routine dispatcher every minute, because `eve dev` doesn't run cron schedules.

### Production build

```bash
pnpm build     # eve build && next build apps/web
pnpm start     # starts the built eve runtime (port 4274) and next start
```

`BEZBOT_DEMO_MODEL` is read when the agent is compiled, so set it for `pnpm build` too if you want the demo model in a production build.

## Deploy to Vercel

```bash
eve link                 # link or create the Vercel project
eve deploy               # builds the agent and the web app as one project
```

Before real users sign in:

1. Set `BEZBOT_SECRET` to 32+ random characters. Production deployments refuse to sign anyone in without it.
2. Add **Upstash Redis** and **Vercel Blob** from the Vercel Marketplace. Their env vars are picked up automatically. Without them, data lives in the function's `/tmp` and is lost.
3. Replace the passwordless demo sign-in (`apps/web/app/api/auth/login/route.ts`) with your identity provider. Everything downstream only relies on the signed session cookie.

The routine dispatcher becomes a Vercel Cron Job that runs every minute (per-minute crons need a Vercel Pro plan), and bot computers run in Vercel Sandbox with a desktop.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `BEZBOT_SECRET` (or `AUTH_SECRET`) | Signs session cookies and derives the per-user vault key. Required in production. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` / `KV_REST_API_TOKEN`) | Durable KV store. Local files under `.data/kv` when unset. |
| `BLOB_READ_WRITE_TOKEN` | Private Vercel Blob for the shared drive and screenshots. Local files under `.data/blobs` when unset. |
| `BEZBOT_DEMO_MODEL=1` | Use the scripted offline model. |
| `BEZBOT_SANDBOX` | `vercel` forces Vercel Sandbox, `default` forces the local sandbox. Default: Vercel Sandbox on Vercel, local elsewhere. |
| `BEZBOT_DESKTOP=0` | Skip the desktop (no `computer_use`). Shell and files still work. |
| `BEZBOT_DEV_TICK=0` | Turn off the development routine ticker. |
| `BEZBOT_DATA_DIR` | Where local KV and blob files go (default `.data`). |
| `EVE_NEXT_PRODUCTION_PORT` | Local port for the built eve runtime (default 4274). |

## Project layout

```
agent/                 eve agent (see Architecture)
  lib/                 shared tool, hook, and identity code used by the agent and its teammate subagents
  lib/tools/           tool definitions re-exported from agent/tools and subagents/*/tools
apps/web/              Next.js app: marketing site, /app UI, API routes
lib/                   data layer, auth, templates, persona, and protocol shared by both
scripts/start.mjs      local production server (eve runtime + next start)
```

## Security notes

- Every id-addressed eve route (`/eve/v1/session/:id…`) checks that the session belongs to the signed-in user. Bots, threads, and conversations named in the request context are checked too.
- `localDev()` stays in the auth chain so the eve CLI and TUI work during `eve dev`. It is disabled in production, and even in development it can only open sessions that no Bez Bot user owns.
- Teammate envelopes are signed with `BEZBOT_SECRET`, and a teammate session stays attributed to the user who started it, so message text can't claim another user or bot.
- Saved logins are encrypted at rest and never returned by the API. The model gets a login id, not the password.
- Bot-to-bot messaging is limited by per-bot peer allowlists, an `autonomous` switch, a depth limit, and an hourly budget per workspace.

## Learn more

- [eve documentation](https://eve.dev/docs)
- [eve + Next.js](https://eve.dev/docs/guides/frontend/nextjs)
- [Deploying eve on Vercel](https://eve.dev/docs/guides/deployment/vercel)
