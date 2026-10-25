import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/server/auth/auth.server'

// Better Auth's HTTP API (sign-in, sign-out, password reset, admin endpoints).
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
})
