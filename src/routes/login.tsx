import { Link, createFileRoute, redirect, useRouter, useHydrated } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthCard } from '#/components/AuthCard'
import { Alert, Button, Field, Input, Spinner } from '#/components/ui'
import { getLoginStatusFn } from '#/functions/auth.functions'
import { authClient } from '#/lib/auth-client'

/** Only allow redirects to local paths (prevents open redirects). */
function safeRedirect(value: unknown): string | undefined {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : undefined
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; passwordSet?: boolean } => ({
    redirect: safeRedirect(search.redirect),
    passwordSet: search.passwordSet === true || search.passwordSet === 'true' ? true : undefined,
  }),
  loaderDeps: ({ search }) => ({ redirect: search.redirect }),
  loader: async ({ deps }) => {
    const status = await getLoginStatusFn()
    if (status.role) {
      throw redirect({ href: deps.redirect ?? (status.role === 'admin' ? '/sell' : '/door') })
    }
    return status
  },
  head: () => ({ meta: [{ title: 'Sign in · Community Tickets' }] }),
  component: LoginPage,
})

function LoginPage() {
  const { eventName } = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  // Until hydration, a submit would be a native form post; keep the button disabled.
  const hydrated = useHydrated()

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(undefined)
    const { error } = await authClient.signIn.email({ email, password })
    if (error) {
      setError(error.status === 429 ? error.message : 'Incorrect email or password.')
      setPending(false)
      return
    }
    // The login loader redirects signed-in staff to the right page for their role.
    await router.invalidate()
    await router.navigate({ to: '/login', search: { redirect: search.redirect } })
  }

  return (
    <AuthCard title={eventName} subtitle="Staff sign in">
      {search.passwordSet && (
        <div className="mb-4">
          <Alert tone="green">Your password is set. Sign in with it below.</Alert>
        </div>
      )}
      <form method="post" onSubmit={onSubmit} className="space-y-4">
        <Field label="Email">
          <Input
            type="email"
            name="email"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" error={error}>
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={!hydrated || pending}>
          {pending && <Spinner />} Sign in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/forgot-password" className="font-medium text-indigo-600 hover:underline">
          First time here, or forgot your password?
        </Link>
      </p>
    </AuthCard>
  )
}
