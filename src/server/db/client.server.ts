import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { relations } from './relations'

/** Drizzle over the D1 binding declared in cloudflare.config.ts. */
export const db = drizzle(env.DB, { relations })
