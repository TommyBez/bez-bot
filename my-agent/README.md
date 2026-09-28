# Bez Bot

AI teammates that own a job end to end. Each Bot has a name, a job, and one ongoing conversation with you. Bots share a cloud computer, remember how you work, run routines on a schedule, and message each other to get work done without you in the loop.

Bez Bot is a working clone of the [x.ai/bot](https://x.ai/bot) product (Grok Bot), built on [eve](https://eve.dev) and modeled on its [official docs](https://docs.x.ai/grok-bot/overview). It is not affiliated with xAI.

- **Marketing site**: landing page, jobs, pricing, download, guides, FAQ, a public marketplace of Bot templates, and `/b/<id>` share pages.
- **App** (`/app`): a sidebar of Bots and group chats, one persistent chat per Bot, the Agent Computer view, routines, skills, Auto-review, and settings.

## How it works

| Feature | How it works |
| --- | --- |
| **One conversation per Bot** | Every Bot has exactly one durable eve session (`bot.sessionId`) that lives for the Bot's lifetime. There is no task list and no "new chat" for an existing Bot. Your messages, the Bot's work, messages to and from other Bots, routine runs, and approvals all land in that one chat. A message you send while the Bot is working steers the current turn. |
| New chat (⌘N) | Creates a Bot (from scratch, or typed name first) or a group chat of 2–6 Bots. The first sign-in creates a general Bot named **Bez Bot**, then "Meet a future teammate" suggests Bots from templates. |
| **Bots message each other** | `message_bot` posts into the teammate's own conversation and wakes it. The teammate works and replies the same way, and the reply lands in the sender's conversation and wakes it. Both sides of the handoff are visible in both chats. See [Bot-to-Bot messages](#bot-to-bot-messages). |
| Group chats | 2–6 Bots and you. Write normally and the Bots decide who answers (the rest reply `NO_REPLY`), @-mention to hand a request to one Bot, `@everyone` for all. A Bot's post that @-mentions others wakes them, so Bots pass work among themselves. Each member works in its own session for the group; "work" opens it, including any approval it waits on. |
| Routines | Created by asking the Bot in chat ("Every weekday at 8:00 AM, …"). Each run is posted into the Bot's conversation and the result shows up there. Tasks → Routines in the details panel lists them with Pause/Resume, Test, Edit, Delete, the last 20 runs, and a webhook trigger (`POST` + bearer key). Up to 50 per Bot. |
| Skills | One private library shared by every Bot (`save_skill`, `use_skill`). Type `/` in the composer to reference one. **Teach a task** (in the Agent Computer view) records your screen and the Bot writes it up as a draft skill for you to review. |
| Memory | Per Bot (`remember` / `forget`), shown in the details panel, injected into every turn. |
| The computer | One cloud computer per user, shared by all Bots (files, browser sessions, logins); each Bot gets its own screen. `/workspace/shared` syncs to blob storage between sessions, and an optional Linux desktop is driven by eve's `computer_use`. |
| Auto-review | Account-wide. A reviewer model checks risky actions and asks only when needed. The **Review an action** card offers Allow once / Always allow / Deny; Always allow saves a rule. "Ask first" and "Allow automatically" rules live in Settings, and Ask first wins. |
| Sidebar states | Working ("typing…"), Needs attention (a question or approval), and Unread activity. Pin, hide, mark unread, duplicate, copy conversation ID, delete. ⌘K search, ⌘1–9 jump to a Bot, Alt+↑/↓ to move between Bots. Per-Bot OS notifications when a Bot finishes or needs input. |
| Logins | An AES-256-GCM vault. `use_login` types credentials into the desktop without the model ever seeing the password. |
| Sharing | Share → Create template publishes a `/b/<id>` link with the Bot's identity, description, skills, and routines, never your computer, logins, or history. |

## Bot-to-Bot messages

The real product says a Bot "can send an asynchronous message to another Bot. The receiving Bot wakes, handles the request, and can reply later," and those messages "show up in the Bots' own chats." Bez Bot builds that from eve primitives:

1. **`message_bot`** (`agent/tools/message_bot.ts`) records the exchange and calls `deliverToBot()` (`lib/delivery.ts`), which posts the message into the recipient's session through the eve HTTP API with `turnPolicy: "queue"`, so it waits for any turn in progress.
2. The post carries a **signed delivery credential** (`x-bezbot-internal`). The eve channel (`agent/channels/eve.ts`) verifies it and turns its claims (user, Bot, source `teammate`, sender, exchange) into the turn's `auth.current`. The persona reads that to tell the recipient who wrote and how to reply.
3. The recipient works on the shared computer and replies with `message_bot` using the same `conversationId`. If a turn that answers a request ends without a reply, the status hook sends the Bot's final message back, so the sender always wakes up.
4. The reply lands in the sender's conversation and starts a new turn there. Loops are bounded by a per-exchange hop limit and an hourly budget per account.

Routine runs and group-chat traffic use the same delivery path with sources `routine` and `group`.

## Architecture

```
apps/web (Next.js 16)                     agent/ (eve)
├─ marketing pages                        ├─ agent.ts             defineAgent (model, compaction, no session timeout)
├─ /app UI ── useEveAgent ───────────────▶ ├─ channels/eve.ts       cookie + signed delivery auth, ownership checks
│   one session per Bot, resumed          ├─ instructions/         base rules + dynamic persona per turn
├─ /api/* bots, groups, routines, skills, ├─ tools/                message_bot, create_bot, skills, routines,
│   autoreview, computer, vault           │                         memory, bash, computer, logins
└─ withEve() proxies /eve/v1/**           ├─ hooks/                status, auto-reply, group posting, drive sync
                                          ├─ schedules/dispatch.ts every minute: post due routine runs
lib/ (shared by both)                     └─ sandbox.ts            Vercel Sandbox (desktop) or local sandbox
├─ delivery.ts   create sessions, post signed deliveries
├─ groups.ts     group fan-out by mention
├─ routines.ts   start a run in the Bot's chat
├─ store/        KV (Upstash Redis | files), blobs (Vercel Blob | files)
└─ auth.ts, protocol.ts, persona.ts, templates.ts, schedule.ts, actions.ts
```

- **Sessions.** The app creates each Bot's session once, bodyless, with an `operationId` (create-once), and registers it (`sessionId → user, Bot, kind`). The browser can read and write sessions it owns but can't create new ones, so a Bot never gets a second conversation.
- **Persona.** One agent definition serves every Bot. `instructions/persona.ts` resolves the Bot, its teammates, skills, routines, memory, and the current turn's source on each turn.
- **Storage.** Upstash Redis and private Vercel Blob in production. Local files under `.data/` otherwise.

## Run it locally

Requires Node 24 and pnpm.

```bash
pnpm install
BEZBOT_DEMO_MODEL=1 pnpm dev      # scripted offline model, no credentials needed
```

Open http://localhost:3000, sign in with any email, and pick a teammate (for example Sales Outbound). Add Research from the Marketplace, then ask Sales Outbound: "Ask Research for the top 5 fintechs hiring RevOps, then draft emails." Open Research to see the request in its own chat, then come back for the reply.

`BEZBOT_DEMO_MODEL=1` swaps in a scripted model (`agent/lib/demo-brain.ts`). It uses the real tools, covering handoffs between Bots in both chats, group chats, memory, routines, skills, and approvals. To use a real model, run `eve link` to connect a Vercel project with AI Gateway access (or set `AI_GATEWAY_API_KEY`), then `pnpm dev`. The model is set in `agent/lib/model.ts`.

In development, a ticker in `apps/web/instrumentation.ts` fires the routine dispatcher every minute, because `eve dev` doesn't run cron schedules.

### Production build

```bash
pnpm build     # eve build && next build apps/web
pnpm start     # starts the built eve runtime (port 4274) and next start
```

`BEZBOT_DEMO_MODEL` is read when the agent is compiled, so set it for `pnpm build` too if you want the demo model in a production build. A production runtime refuses to sign cookies or credentials without `BEZBOT_SECRET`, so set it for `pnpm start` as well (for example `BEZBOT_SECRET=$(openssl rand -hex 32) pnpm start`).

## Deploy to Vercel

```bash
eve link                 # link or create the Vercel project
eve deploy               # builds the agent and the web app as one project
```

Before real users sign in:

1. Set `BEZBOT_SECRET` to 32+ random characters. Every production runtime (preview or production, Vercel or self-hosted) refuses to sign anyone in without it.
2. Add **Upstash Redis** and **Vercel Blob** from the Vercel Marketplace. Their env vars are picked up automatically. Without them, data lives in the function's `/tmp` and is lost.
3. Replace the passwordless demo sign-in (`apps/web/app/api/auth/login/route.ts`) with your identity provider. Everything downstream only relies on the signed session cookie.
4. If Deployment Protection is on, set `VERCEL_AUTOMATION_BYPASS_SECRET` so server-side deliveries can reach the deployment's own `/eve/v1` routes.

The routine dispatcher becomes a Vercel Cron Job that runs every minute (per-minute crons need a Vercel Pro plan), and the computer runs in Vercel Sandbox with a desktop.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `BEZBOT_SECRET` (or `AUTH_SECRET`) | Signs session cookies and delivery credentials, and derives the per-user vault key. Required whenever `NODE_ENV=production`, including `pnpm start` and Vercel previews. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` / `KV_REST_API_TOKEN`) | Durable KV store. Local files under `.data/kv` when unset. |
| `BLOB_READ_WRITE_TOKEN` | Private Vercel Blob for the shared drive and screenshots. Local files under `.data/blobs` when unset. |
| `BEZBOT_DEMO_MODEL=1` | Use the scripted offline model. |
| `BEZBOT_EVE_ORIGIN` | Where server code reaches `/eve/v1` (defaults: `https://$VERCEL_URL` on Vercel, the dev server in development, `127.0.0.1:4274` for `pnpm start`). |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Lets deliveries through Vercel Deployment Protection. |
| `BEZBOT_SANDBOX` | `vercel` forces Vercel Sandbox, `default` forces the local sandbox. Default: Vercel Sandbox on Vercel, local elsewhere. |
| `BEZBOT_DESKTOP=0` | Skip the desktop (no `computer_use`). Shell and files still work. |
| `BEZBOT_DEV_TICK=0` | Turn off the development routine ticker. |
| `BEZBOT_DATA_DIR` | Where local KV and blob files go (default `.data`). |
| `EVE_NEXT_PRODUCTION_PORT` | Local port for the built eve runtime (default 4274). |

## Project layout

```
agent/                 eve agent (see Architecture)
apps/web/              Next.js app: marketing site, /app UI, API routes
lib/                   data layer, delivery, auth, templates, persona, and protocol shared by both
scripts/start.mjs      local production server (eve runtime + next start)
```

## Security notes

- Every id-addressed eve route (`/eve/v1/session/:id…`) checks that the session belongs to the signed-in user. Browsers can't create sessions; the app creates exactly one per Bot (and one per group seat).
- Deliveries from server code carry a short-lived HMAC credential tied to one user and Bot, checked against the session registry. A turn's source (teammate, routine, group) comes from that credential, never from message text; the headers you see in messages are display-only.
- `localDev()` stays in the auth chain so the eve CLI and TUI work during `eve dev`. It is disabled in production, and even in development it can only open sessions that no Bez Bot user owns.
- Saved logins are encrypted at rest and never returned by the API. The model gets a login id, not the password.
- Messages between Bots are limited by a hop count per exchange and an hourly budget per account.

## Learn more

- [eve documentation](https://eve.dev/docs)
- [eve + Next.js](https://eve.dev/docs/guides/frontend/nextjs)
- [Deploying eve on Vercel](https://eve.dev/docs/guides/deployment/vercel)
- [Grok Bot docs](https://docs.x.ai/grok-bot/overview), the product this clones
