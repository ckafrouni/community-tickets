import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { env, waitUntil } from 'cloudflare:workers'
import { randomToken } from '../crypto.server'
import { db } from '../db/client.server'
import * as schema from '../db/schema'
import { sendPasswordEmail, sendVerificationEmail } from '../email.server'
import { authOptions } from './options'

const DAY = 60 * 60 * 24

const RATE_LIMITED_PATHS = new Set([
  '/sign-in/email',
  '/sign-up/email',
  '/request-password-reset',
  '/reset-password',
  '/send-verification-email',
])

export const auth = betterAuth({
  ...authOptions,
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  emailAndPassword: {
    ...authOptions.emailAndPassword,
    resetPasswordTokenExpiresIn: DAY,
    sendResetPassword: sendPasswordEmail,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: DAY,
    sendVerificationEmail,
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
        throw new APIError('TOO_MANY_REQUESTS', { message: 'Trop de tentatives. Patientez une minute puis réessayez.' })
      }
    }),
  },
  // tanstackStartCookies must stay last.
  plugins: [...authOptions.plugins, tanstackStartCookies()],
})

export type SessionUser = { id: string; name: string; email: string; isAdmin: boolean }

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session || session.user.banned) return null
  const { id, name, email, role } = session.user
  return { id, name, email, isAdmin: role === 'admin' }
}

export function nameFromEmail(email: string) {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

export async function createUserWithoutPassword(input: { email: string; name: string; role?: 'admin' | 'user' }) {
  const { user } = await auth.api.createUser({
    body: {
      email: input.email,
      name: input.name,
      role: input.role ?? 'user',
      password: randomToken(),
      data: { emailVerified: true },
    },
  })
  return user
}

export async function ensureDefaultAdmin() {
  const email = env.ADMIN_EMAIL.toLowerCase()
  const existing = await db.query.user.findFirst({ columns: { id: true }, where: { email } })
  if (existing) return
  try {
    await createUserWithoutPassword({ email, name: nameFromEmail(email), role: 'admin' })
  } catch (error) {
    if (!(await db.query.user.findFirst({ columns: { id: true }, where: { email } }))) throw error
  }
}
