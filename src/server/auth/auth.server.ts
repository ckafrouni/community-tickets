import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { env, waitUntil } from 'cloudflare:workers'
import { parseRole, type Role } from '#/lib/permissions'
import { randomToken } from '../crypto.server'
import { db } from '../db/client.server'
import * as schema from '../db/schema'
import { sendPasswordLinkEmail } from '../email.server'
import { authOptions } from './options'

const RATE_LIMITED_PATHS = new Set(['/sign-in/email', '/request-password-reset', '/reset-password'])

export const auth = betterAuth({
  ...authOptions,
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  emailAndPassword: {
    ...authOptions.emailAndPassword,
    resetPasswordTokenExpiresIn: 60 * 60 * 24,
    sendResetPassword: ({ user, url }) => sendPasswordLinkEmail({ to: user.email, name: user.name, url }),
  },
  advanced: {
    ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    backgroundTasks: { handler: waitUntil },
  },
  rateLimit: { enabled: false },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!RATE_LIMITED_PATHS.has(ctx.path)) return
      const ip = ctx.request?.headers.get('cf-connecting-ip') ?? 'local'
      const { success } = await env.LOGIN_RATE_LIMITER.limit({ key: `${ctx.path}:${ip}` })
      if (!success) {
        throw new APIError('TOO_MANY_REQUESTS', { message: 'Too many attempts. Please wait a minute and try again.' })
      }
    }),
  },
  // tanstackStartCookies must stay last.
  plugins: [...authOptions.plugins, tanstackStartCookies()],
})

export type StaffSession = { userId: string; name: string; email: string; role: Role }

export async function getStaffSession(): Promise<StaffSession | null> {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  const role = parseRole(session?.user.role)
  if (!session || !role || session.user.banned) return null
  return { userId: session.user.id, name: session.user.name, email: session.user.email, role }
}

function nameFromEmail(email: string) {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

export async function ensureDefaultAdmin() {
  const email = env.ADMIN_EMAIL.toLowerCase()
  const existing = await db.query.user.findFirst({ columns: { id: true }, where: { email } })
  if (existing) return
  try {
    await auth.api.createUser({
      body: {
        email,
        name: nameFromEmail(email),
        role: 'admin',
        password: randomToken(),
        data: { emailVerified: true },
      },
    })
  } catch (error) {
    if (!(await db.query.user.findFirst({ columns: { id: true }, where: { email } }))) throw error
  }
}
