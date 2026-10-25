import { defineConfig } from 'drizzle-kit'

// `drizzle-kit generate` writes one folder per migration (migration.sql +
// snapshot.json) into ./migrations. Cloudflare applies them to D1 with
// `cf d1 migrations apply` (see the db:migrate scripts in package.json).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema.ts',
  out: './migrations',
})
