// Used only by the Better Auth CLI to generate the Drizzle schema for its tables:
//   npm run auth:generate
// The runtime instance (with the D1 database, secrets and email) lives in
// src/server/auth/auth.server.ts and reuses the same options.
import { betterAuth } from 'better-auth'
import { authOptions } from './src/server/auth/options'

export const auth = betterAuth(authOptions)
