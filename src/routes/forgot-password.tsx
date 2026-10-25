import { Link, createFileRoute, useHydrated } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthCard, authLinkClass } from '#/components/AuthCard'
import { Alert, Button, Field, Input, Spinner } from '#/components/ui'
import { getLoginStatusFn } from '#/functions/auth.functions'
import { authClient } from '#/lib/auth-client'
import { formText } from '#/lib/form'

export const Route = createFileRoute('/forgot-password')({
  loader: () => getLoginStatusFn(),
  head: () => ({ meta: [{ title: 'Reset your password · Community Tickets' }] }),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string>()
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const hydrated = useHydrated()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = formText(new FormData(event.currentTarget), 'email')
    setPending(true)
    setError(undefined)
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' })
    setPending(false)
    if (error) setError(error.message ?? 'Something went wrong. Please try again.')
    else setSentTo(email)
  }

  return (
    <AuthCard
      title={sentTo ? 'Check your inbox' : 'Reset your password'}
      subtitle={sentTo ? undefined : "We'll email you a link to choose a new one."}
      footer={
        <p>
          <Link to="/login" className={authLinkClass}>
            Back to sign in
          </Link>
        </p>
      }
    >
      {sentTo ? (
        <p className="text-[15px] text-zinc-600">
          If {sentTo} has an account, it will get a link within a minute. The link works for 24 hours. Can't find it?
          Check your spam folder.
        </p>
      ) : (
        <form method="post" onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">
            <Input type="email" name="email" inputMode="email" autoComplete="username" autoCapitalize="none" required />
          </Field>
          {error && <Alert tone="red">{error}</Alert>}
          <Button type="submit" size="lg" className="w-full" disabled={!hydrated || pending}>
            {pending && <Spinner />} Email me a link
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
