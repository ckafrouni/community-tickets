import type { BetterAuthOptions } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { ac, roles } from '../../lib/permissions'

export const authOptions = {
  appName: 'Community Tickets',
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
  },
  plugins: [admin({ ac, roles, defaultRole: 'door' })],
} satisfies BetterAuthOptions
