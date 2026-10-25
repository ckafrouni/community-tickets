import { Link, createFileRoute, redirect, useHydrated, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthCard, authLinkClass } from '#/components/AuthCard'
import { Alert, Button, Field, Input, Spinner } from '#/components/ui'
import { getLoginStatusFn } from '#/functions/auth.functions'
import { authClient } from '#/lib/auth-client'
import { formText } from '#/lib/form'

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
    const { signedIn } = await getLoginStatusFn()
    if (signedIn) throw redirect({ href: deps.redirect ?? '/events' })
  },
  head: () => ({ meta: [{ title: 'Sign in · Community Tickets' }] }),
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const router = useRouter()
  const [error, setError] = useState<{ tone: 'red' | 'amber'; text: string }>()
  const [pending, setPending] = useState(false)
  const hydrated = useHydrated()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(undefined)
    const { error } = await authClient.signIn.email({
      email: formText(form, 'email'),
      password: formText(form, 'password'),
      callbackURL: '/events',
    })
    if (error) {
      setError(
        error.status === 403
          ? { tone: 'amber', text: 'Confirm your email first. We just sent you a new link.' }
          : { tone: 'red', text: error.status === 429 ? error.message! : 'Incorrect email or password.' },
      )
      setPending(false)
      return
    }
    await router.invalidate()
    await router.navigate({ href: search.redirect ?? '/events' })
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to manage your events."
      footer={
        <p>
          New here?{' '}
          <Link to="/signup" className={authLinkClass}>
            Create an account
          </Link>
        </p>
      }
    >
      {search.passwordSet && (
        <div className="mb-4">
          <Alert tone="green">Your password is set. Sign in with it below.</Alert>
        </div>
      )}
      <form method="post" onSubmit={onSubmit} className="space-y-4">
        <Field label="Email">
          <Input type="email" name="email" inputMode="email" autoComplete="username" autoCapitalize="none" required />
        </Field>
        <Field label="Password">
          <Input type="password" name="password" autoComplete="current-password" required />
        </Field>
        {error && <Alert tone={error.tone}>{error.text}</Alert>}
        <Button type="submit" size="lg" className="w-full" disabled={!hydrated || pending}>
          {pending && <Spinner />} Sign in
        </Button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="font-medium text-zinc-500 hover:text-zinc-900">
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
