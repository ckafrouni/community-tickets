import { Link, createFileRoute, useNavigate, useHydrated } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthCard } from '#/components/AuthCard'
import { Alert, Button, Field, Input, Spinner } from '#/components/ui'
import { authClient } from '#/lib/auth-client'

const MIN_LENGTH = 10

// Better Auth redirects here from the emailed link with ?token=… (or ?error=INVALID_TOKEN).
export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>): { token?: string; error?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  head: () => ({ meta: [{ title: 'Choose a password · Community Tickets' }] }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token, error: linkError } = Route.useSearch()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  // Until hydration, a submit would be a native form post; keep the button disabled.
  const hydrated = useHydrated()

  if (!token || linkError) {
    return (
      <AuthCard title="Link expired" subtitle="Choose a password">
        <Alert tone="red">This link is invalid or has expired. Request a new one.</Alert>
        <p className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className="font-medium text-indigo-600 hover:underline">
            Send me a new link
          </Link>
        </p>
      </AuthCard>
    )
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      setError("The passwords don't match.")
      return
    }
    setPending(true)
    setError(undefined)
    const { error } = await authClient.resetPassword({ newPassword: password, token })
    if (error) {
      setError(error.message ?? 'Could not set the password. The link may have expired.')
      setPending(false)
      return
    }
    await navigate({ to: '/login', search: { passwordSet: true } })
  }

  return (
    <AuthCard title="Choose a password" subtitle={`At least ${MIN_LENGTH} characters`}>
      <form method="post" onSubmit={onSubmit} className="space-y-4">
        <Field label="New password">
          <Input
            type="password"
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirm password" error={error}>
          <Input
            type="password"
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={!hydrated || pending}>
          {pending && <Spinner />} Save password
        </Button>
      </form>
    </AuthCard>
  )
}
