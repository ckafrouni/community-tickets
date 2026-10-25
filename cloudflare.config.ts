import { bindings, defineConfig } from 'cf/config'

const DOMAIN = 'tickets.otterware.app'
const SENDER = 'tickets@otterware.app'

export default defineConfig(({ mode }) => ({
  accountId: 'c2256e4c101903cb1e0aa34527ebcb81',
  worker: {
    name: 'community-tickets',
    compatibilityDate: '2026-10-19',
    // TanStack Start keeps per-request context in AsyncLocalStorage (node:async_hooks).
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: '@tanstack/react-start/server-entry',
    domains: [DOMAIN],
    // Serve only on the custom domain so emailed links have one canonical origin.
    workersDev: false,
    observability: { enabled: true },
    env: {
      DB: bindings.d1({ name: 'community-tickets', id: '12c0001b-54c0-443e-b8ed-b2dcec8a0dcc' }),
      EMAIL: bindings.sendEmail({ allowedSenderAddresses: [SENDER] }),
      EMAIL_FROM: bindings.text(SENDER),
      // Better Auth base URL: links in emails and the trusted origin for sign-in.
      APP_URL: bindings.text(mode === 'development' ? 'http://localhost:3000' : `https://${DOMAIN}`),
      // The organizer account, created on first visit (see ensureDefaultAdmin).
      ADMIN_EMAIL: bindings.text('chris.kafrouni@gmail.com'),
      // Sign-in and password-reset attempts per minute, per client IP and endpoint.
      LOGIN_RATE_LIMITER: bindings.rateLimit({ namespace: '1001', simple: { limit: 5, period: 60 } }),
      // Signs Better Auth sessions and tokens.
      BETTER_AUTH_SECRET: bindings.secret(),
      // Signs ticket QR codes. Rotating it invalidates every issued ticket.
      TICKET_SECRET: bindings.secret(),
    },
  },
}))
