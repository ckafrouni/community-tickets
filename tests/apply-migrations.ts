import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'

// Bring the test D1 database to the current schema (migrations/*/migration.sql).
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
