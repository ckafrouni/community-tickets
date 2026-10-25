# Community Tickets

Sell tickets for cash at a community event, email each buyer QR-code tickets, and check people in at the door by
scanning them.

Live at **https://tickets.otterware.app**. Runs entirely on Cloudflare.

| Layer     | What                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| App       | [TanStack Start](https://tanstack.com/start) (React, file routes, server functions)                                                    |
| Runtime   | [Cloudflare Workers](https://developers.cloudflare.com/workers/) via the Cloudflare Vite plugin                                        |
| Database  | [D1](https://developers.cloudflare.com/d1/) with [Drizzle ORM v1](https://orm.drizzle.team/)                                           |
| Auth      | [Better Auth](https://better-auth.com/) (email + password, admin plugin for roles)                                                     |
| Email     | [Cloudflare Email Service](https://developers.cloudflare.com/email-service/) (`send_email` binding)                                    |
| Abuse     | [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) on sign-in and password links     |
| Toolchain | [Vite+](https://viteplus.dev/) (`vp dev`, `vp check`, `vp test`, `vp build`) and the [`cf` CLI](https://developers.cloudflare.com/cf/) |
| Deploys   | [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) on every push to `main`                                      |

## What it does

- **Sell**: take the cash, type the buyer's name and email, pick the number of tickets. The amount is pre-filled from
  the ticket price and can be changed.
- **Email tickets**: each buyer gets one QR code per ticket (inline images), a link to view each ticket online, and a
  receipt. No email? Show the QR on screen or share the link.
- **Track buyers**: searchable orders with totals, CSV export, edit, resend, cancel/refund.
- **Check in at the door**: scan with any phone. Green, amber or red screens with a beep; "Admit 3 more" for groups; a
  search box for codes that won't scan. Each ticket gets in once, even with several phones scanning.
- **Staff**: organizers invite door volunteers (scan-only) or other organizers on the Staff page. Everyone sets their own
  password through an emailed link.

## Signing in

`ADMIN_EMAIL` (in `cloudflare.config.ts`) is the organizer account. It is created automatically the first time anyone
opens the sign-in page, without a usable password. To get in, open **First time here, or forgot your password?**,
enter that email, and follow the link to choose a password. The same flow works for anyone an organizer invites.

There is no public sign-up.

## How tickets are protected

- Every ticket has a random 128-bit ID. The QR code carries that ID plus an HMAC-SHA256 signature made with
  `TICKET_SECRET`, a Worker secret. Codes cannot be forged or guessed.
- Scanning verifies the signature, then D1: the ticket must exist, its order must not be cancelled, and it must not be
  checked in yet. Check-in is a single conditional `UPDATE`, so a copied or forwarded QR gets in at most once.
- Every organizer and door action is checked on the server (Better Auth session plus role). Door staff cannot sell,
  cancel, export, change settings or manage staff.
- Server functions reject cross-site requests (TanStack Start CSRF middleware). Ticket links are kept out of `Referer`
  headers.

## Development

Requires Node.js 24 LTS (pinned in `.node-version`; Vite+ installs it for you).

```bash
vp install                 # or: npm install
cp .dev.vars.example .dev.vars   # then fill in two random values: openssl rand -base64 32
npm run db:migrate:local   # create the local D1 database
vp dev                     # http://localhost:3000
```

Local development runs on `workerd` with local D1, rate limiting and a simulated email binding: emails are printed in
the dev server output and saved under `.cloudflare/tmp/email/`, including the set-password links.

| Command                    | What it does                                                        |
| -------------------------- | ------------------------------------------------------------------- |
| `vp dev`                   | Dev server                                                          |
| `vp check`                 | Format, lint (type-aware) and type-check                            |
| `vp test`                  | Tests in `workerd` against a fresh D1 (`@cloudflare/vitest-plugin`) |
| `npm run typecheck`        | Regenerates Worker types from `cloudflare.config.ts`, then `tsc`    |
| `vp build`                 | Production build into `.cloudflare/output/v0`                       |
| `npm run db:generate`      | Generate a migration from `src/server/db/schema.ts` (drizzle-kit)   |
| `npm run db:migrate:local` | Apply migrations to the local D1                                    |
| `npm run auth:generate`    | Regenerate Better Auth's tables after changing its plugins          |

A pre-commit hook runs `vp check --fix` on staged files.

### Changing the database

1. Edit `src/server/db/schema.ts`.
2. `npm run db:generate`, which writes `migrations/<timestamp>_<name>/migration.sql`.
3. `npm run db:migrate:local` and test.
4. Commit. Production is migrated by the next deploy.

Keep migrations backwards compatible (add first, remove later): they run just before the new version goes live.

## Deploying

Every push to `main` deploys through **Workers Builds** (Cloudflare's Git integration):

- **Build command:** `npm run build`
- **Deploy command:** `npm run deploy:prebuilt`, which applies pending D1 migrations, then runs
  `cf deploy --prebuilt --mode production`

`cloudflare.config.ts` is the single source of truth: account, Worker name, custom domain, D1 database, email sender
and rate limits. A manual deploy from your machine is `npm run deploy` (needs `cf auth login`).

One-time setup, already done for this account:

- D1 database `community-tickets`.
- Email Sending enabled for `otterware.app` (records under `cf-bounce.otterware.app`).
- Worker secrets `BETTER_AUTH_SECRET` and `TICKET_SECRET` (`cf workers secrets list --worker community-tickets`).
  They persist across deploys. Rotating `TICKET_SECRET` invalidates every ticket already issued.

## Project layout

```
cloudflare.config.ts      Worker, bindings, domain (cf CLI + Cloudflare Vite plugin)
vite.config.ts            Vite+ config: plugins, fmt, lint, staged
migrations/               D1 migrations generated by drizzle-kit
src/
  routes/                 pages and server routes (TanStack Router file routes)
    api/auth/$.ts         Better Auth handler
  functions/              server functions, each guarded by auth middleware
  server/                 server-only code
    auth/                 Better Auth instance and options
    db/                   Drizzle schema, relations, D1 client
  lib/                    shared helpers, roles, validation
  start.ts                CSRF and security-header middleware
tests/                    Vitest suites run inside workerd
```
