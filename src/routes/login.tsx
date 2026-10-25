import { Link, createFileRoute, redirect, useHydrated, useRouter } from '@tanstack/react-router'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { AuthCard, authLinkClass } from '#/components/AuthCard'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
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
  const [error, setError] = useState<string>()
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
          ? 'Confirm your email first. We just sent you a new link.'
          : error.status === 429
            ? (error.message ?? 'Too many attempts. Please wait a minute.')
            : 'Incorrect email or password.',
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
      <form method="post" onSubmit={onSubmit}>
        <FieldGroup>
          {search.passwordSet && (
            <Alert>
              <CircleCheck className="text-emerald-600" />
              <AlertDescription>Your password is set. Sign in with it below.</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="login-email">Email</FieldLabel>
            <Input
              id="login-email"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="login-password">Password</FieldLabel>
            <Input id="login-password" type="password" name="password" autoComplete="current-password" required />
          </Field>
          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" disabled={!hydrated || pending}>
            {pending && <Spinner />} Sign in
          </Button>
          <Link to="/forgot-password" className="text-center text-sm text-muted-foreground hover:text-foreground">
            Forgot your password?
          </Link>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
