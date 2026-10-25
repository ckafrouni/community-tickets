import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, lazyPlugins } from 'vite-plus'

// Written by tools; regenerate instead of editing (tsr, drizzle-kit, `npm run auth:generate`).
const GENERATED_FILES = ['src/routeTree.gen.ts', 'migrations/**', 'src/server/db/auth-schema.ts']

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  // Keep the project's existing code style (single quotes, no semicolons).
  fmt: {
    singleQuote: true,
    semi: false,
    printWidth: 120,
    ignorePatterns: GENERATED_FILES,
  },
  lint: {
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: GENERATED_FILES,
  },
  resolve: { tsconfigPaths: true },
  server: {
    port: 3000,
    // Keep local secrets and Cloudflare state out of the dev server.
    fs: { deny: ['.env', '.env.*', '.dev.vars*', '.cloudflare/**', '*.{crt,pem}', '**/.git/**'] },
  },
  plugins: lazyPlugins(() => [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ]),
})
