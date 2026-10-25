import type { BetterAuthOptions } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { ac, roles } from '../../lib/permissions'

/**
 * Better Auth options that shape the database schema. Kept free of
 * Cloudflare imports so `npx auth generate` (see auth.cli.ts) can load them.
 */
export const authOptions = {
  appName: 'Community Tickets',
  emailAndPassword: {
    enabled: true,
    // Accounts are created by an admin (or bootstrapped for ADMIN_EMAIL);
    // people set their password through an emailed link.
    disableSignUp: true,
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
  },
  plugins: [admin({ ac, roles, defaultRole: 'door' })],
} satisfies BetterAuthOptions
