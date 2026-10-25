import { Link, createFileRoute, useHydrated } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthCard } from '#/components/AuthCard'
import { Alert, Button, Field, Input, Spinner } from '#/components/ui'
import { getLoginStatusFn } from '#/functions/auth.functions'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/forgot-password')({
  loader: () => getLoginStatusFn(),
  head: () => ({ meta: [{ title: 'Set your password · Community Tickets' }] }),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const { eventName } = Route.useLoaderData()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const hydrated = useHydrated()

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(undefined)
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' })
    setPending(false)
    if (error) setError(error.message ?? 'Something went wrong. Please try again.')
    else setSent(true)
  }

  return (
    <AuthCard title={eventName} subtitle="Set or reset your password">
      {sent ? (
        <Alert tone="green" title="Check your inbox">
          If {email} has a staff account, we've emailed it a link to set a password. The link works for 24 hours.
        </Alert>
      ) : (
        <form method="post" onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-slate-600">Enter your email and we'll send you a link to choose a password.</p>
          <Field label="Email" error={error}>
            <Input
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={!hydrated || pending}>
            {pending && <Spinner />} Email me a link
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="font-medium text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  )
}
