import { bindings, defineConfig } from 'cf/config'

const DOMAIN = 'tickets.otterware.app'
const SENDER = 'tickets@otterware.app'
const LOCAL_URLS: Record<string, string> = { development: 'http://localhost:3000', e2e: 'http://localhost:3100' }

export default defineConfig(({ mode }) => ({
  accountId: 'c2256e4c101903cb1e0aa34527ebcb81',
  worker: {
    name: 'community-tickets',
    compatibilityDate: '2026-10-19',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: '@tanstack/react-start/server-entry',
    domains: [DOMAIN],
    workersDev: false,
    observability: { enabled: true },
    env: {
      DB: bindings.d1({ name: 'community-tickets', id: '12c0001b-54c0-443e-b8ed-b2dcec8a0dcc' }),
      EMAIL: bindings.sendEmail({ allowedSenderAddresses: [SENDER] }),
      EMAIL_FROM: bindings.text(SENDER),
      APP_URL: bindings.text((mode && LOCAL_URLS[mode]) || `https://${DOMAIN}`),
      ADMIN_EMAIL: bindings.text('chris.kafrouni@gmail.com'),
      LOGIN_RATE_LIMITER: bindings.rateLimit({ namespace: '1001', simple: { limit: 5, period: 60 } }),
      BETTER_AUTH_SECRET: bindings.secret(),
      TICKET_SECRET: bindings.secret(),
    },
  },
}))
