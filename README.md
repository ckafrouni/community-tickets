# Community Tickets

Run community events from your phone: sell tickets for cash or bank transfer, email each buyer QR-code tickets, and
check people in at the door by scanning them. Mobile-first, in the spirit of Luma. The app, emails and CSV export are in
French; URLs stay in English.

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

- **Your events**: anyone can create an account (email + password, confirmed by email) and create events. Signing in
  shows the events you run, split into Upcoming and Past. Buyers never need an account.
- **Ticket types**: each event has its own prices (Plein tarif, Étudiant, Enfant at 0 €…), edited in its settings. A
  type that has been sold is archived instead of deleted.
- **Sell**: type the buyer's name and email (required, it is how tickets arrive), pick how many tickets of each type,
  then either take the cash now or choose **Virement plus tard**.
- **Payments**: an order is paid, partly paid or unpaid; the amount paid is the sum of recorded payments (cash or
  transfer). A buyer paying by transfer gets an email with the amount, the event's bank details and a reference
  (`CT42` for order 42) to put in the transfer. When the money arrives, search the reference in Guests and record it.
  Tickets are emailed as soon as an order is fully paid, and the guest list has an **À payer** filter.
- **Email tickets**: each buyer gets one QR code per ticket (inline images), a link to view each ticket online, and a
  receipt with the payments.
- **Guests**: searchable list per event (name, email, code or reference) with arrival and payment status, CSV export,
  edit, resend, cancel/refund.
- **Check-in**: scan with any phone. Green, amber or red screens with a beep; "Admit 3 more" for groups; a search box for
  codes that won't scan. Each ticket gets in once, even with several phones scanning, and only at its own event. Tickets
  of unpaid orders are refused with the amount still due.
- **Team**: each event has organizers (everything) and volunteers (check-in only), invited by email from the event's
  settings. New people choose their password through the invite link.

The UI is designed for phones first: a bottom tab bar inside each event, sticky primary actions within thumb reach,
44 px touch targets, and sheets instead of dialogs.

## Signing in

Create an account at `/signup` and confirm your email. `ADMIN_EMAIL` (in `cloudflare.config.ts`) is the platform admin:
it is created automatically without a usable password, can open every event, and gets in through **Forgot your
password?** like anyone else.

## How tickets are protected

- Every ticket has a random 128-bit ID. The QR code carries that ID plus an HMAC-SHA256 signature made with
  `TICKET_SECRET`, a Worker secret. Codes cannot be forged or guessed.
- Scanning verifies the signature, then D1: the ticket must exist, its order must be fully paid and not cancelled, and
  it must not be checked in yet. Check-in is a single conditional `UPDATE`, so a copied or forwarded QR gets in at most once.
- Every action is checked on the server against the caller's role on that event (Better Auth session plus the
  `event_members` table). Volunteers cannot sell, record payments, cancel, export, edit the event or manage the team,
  and nobody can read or check in another event's guests. Sale totals are computed on the server from the event's
  ticket types.
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
| `npm run e2e`              | Mobile end-to-end tests: iPhone (WebKit) and Android (Chromium)     |
| `npm run typecheck`        | Regenerates Worker types from `cloudflare.config.ts`, then `tsc`    |
| `vp build`                 | Production build into `.cloudflare/output/v0`                       |
| `npm run db:generate`      | Generate a migration from `src/server/db/schema.ts` (drizzle-kit)   |
| `npm run db:migrate:local` | Apply migrations to the local D1                                    |
| `npm run auth:generate`    | Regenerate Better Auth's tables after changing its plugins          |

A pre-commit hook runs `vp check --fix` on staged files.

### Mobile end-to-end tests

`npm run e2e` builds the app and serves it on port 3100 (`vp build --mode e2e`, then `vp preview`) with its own fresh
local D1 under `.cloudflare/e2e`, then drives the whole organizer flow on an iPhone 15 and a Pixel 7 profile: sign up
and confirm the email, create an event with two ticket types, sell for cash, check in, open the emailed ticket signed
out, sell by transfer and record the payment later, invite a volunteer and confirm they only see check-in. It also fails on sideways scrolling and touch targets under 44 px. Screenshots of every screen land in
`.playwright/results/`. First run: `npx playwright install chromium webkit`.

### Changing the database

1. Edit `src/server/db/schema.ts`.
2. `npm run db:generate`, which writes `migrations/<timestamp>_<name>/migration.sql`.
3. `npm run db:migrate:local` and test.
4. Commit. Production is migrated by the next deploy.

Keep migrations backwards compatible (add first, remove later): they run just before the new version goes live. D1
cannot turn foreign keys off, and dropping a parent table cascades to its children, so a migration that rebuilds a table
copies the child rows aside first (see `migrations/20261025134451_ticket_types_and_payments`).

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
- Workers Builds connected to `ckafrouni/community-tickets` (production trigger on `main`, its own least-privilege
  build token).
- Worker secrets `BETTER_AUTH_SECRET` and `TICKET_SECRET` (`cf workers secrets list --worker community-tickets`).
  They persist across deploys. Rotating `TICKET_SECRET` invalidates every ticket already issued.

## Project layout

```
cloudflare.config.ts      Worker, bindings, domain (cf CLI + Cloudflare Vite plugin)
vite.config.ts            Vite+ config: plugins, fmt, lint, staged
migrations/               D1 migrations generated by drizzle-kit
src/
  routes/                 pages and server routes (TanStack Router file routes)
    _app/events/          your events, create, and each event's Sell, Guests, Check-in, Settings, Team
    t.$token.tsx          public ticket page
    api/auth/$.ts         Better Auth handler
  functions/              server functions, each checking the caller's role on the event
  server/                 server-only code
    auth/                 Better Auth instance and options
    db/                   Drizzle schema, relations, D1 client
  lib/                    shared helpers, roles, validation
  start.ts                CSRF and security-header middleware
tests/                    Vitest suites run inside workerd
e2e/                      Playwright mobile end-to-end tests
```
