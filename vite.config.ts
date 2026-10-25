import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, lazyPlugins } from 'vite-plus'

const GENERATED_FILES = [
  'src/routeTree.gen.ts',
  'migrations/**',
  'src/server/db/auth-schema.ts',
  'src/components/ui/**',
]

export default defineConfig(({ mode }) => ({
  staged: {
    '*': 'vp check --fix',
  },
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
    port: mode === 'e2e' ? 3100 : 3000,
    strictPort: true,
    fs: { deny: ['.env', '.env.*', '.dev.vars*', '.cloudflare/**', '*.{crt,pem}', '**/.git/**'] },
  },
  plugins: lazyPlugins(() => [
    cloudflare({
      viteEnvironment: { name: 'ssr' },
      persistState: mode === 'e2e' ? { path: '.cloudflare/e2e' } : true,
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ]),
}))
