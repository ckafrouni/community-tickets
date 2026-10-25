import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vite-plus'

// Tests run inside workerd (the Workers runtime) with a fresh local D1 per test file.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    cloudflareTest(async () => ({
      miniflare: {
        compatibilityDate: '2026-10-19',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: ['DB'],
        bindings: {
          APP_URL: 'http://localhost',
          ADMIN_EMAIL: 'organizer@example.com',
          EMAIL_FROM: 'tickets@example.com',
          BETTER_AUTH_SECRET: 'test-better-auth-secret-0123456789abcdef',
          TICKET_SECRET: 'test-ticket-secret-0123456789abcdef012345',
          TEST_MIGRATIONS: await readD1Migrations({
            migrationsDir: 'migrations',
            migrationsPattern: 'migrations/*/migration.sql',
          }),
        },
      },
    })),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/apply-migrations.ts'],
  },
})
