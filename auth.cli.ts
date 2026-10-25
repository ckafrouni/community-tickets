import { betterAuth } from 'better-auth'
import { authOptions } from './src/server/auth/options'

export const auth = betterAuth(authOptions)
