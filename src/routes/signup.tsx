import { Link, createFileRoute, redirect, useHydrated } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthCard, authLinkClass } from '#/components/AuthCard'
import { Alert, Button, Field, Input, Spinner } from '#/components/ui'
import { getLoginStatusFn } from '#/functions/auth.functions'
import { authClient } from '#/lib/auth-client'
import { formText } from '#/lib/form'

const MIN_LENGTH = 10

export const Route = createFileRoute('/signup')({
  loader: async () => {
    if ((await getLoginStatusFn()).signedIn) throw redirect({ to: '/events' })
  },
  head: () => ({ meta: [{ title: 'Create an account · Community Tickets' }] }),
  component: SignupPage,
})

function SignupPage() {
  const [sentTo, setSentTo] = useState<string>()
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const hydrated = useHydrated()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = formText(form, 'email')
    setPending(true)
    setError(undefined)
    const { error } = await authClient.signUp.email({
      name: formText(form, 'name'),
      email,
      password: formText(form, 'password'),
      callbackURL: '/events',
    })
    setPending(false)
    if (error) {
      setError(error.message ?? 'Could not create the account. Please try again.')
      return
    }
    setSentTo(email)
  }

  if (sentTo) {
    return (
      <AuthCard
        title="Check your inbox"
        subtitle={`We sent a link to ${sentTo}.`}
        footer={
          <p>
            Already confirmed?{' '}
            <Link to="/login" className={authLinkClass}>
              Sign in
            </Link>
          </p>
        }
      >
        <p className="text-[15px] text-zinc-600">
          Open the email and tap <strong>Confirm email</strong> to finish creating your account. The link works for 24
          hours. Can't find it? Check your spam folder.
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Create an account"
      subtitle="Run events, sell tickets for cash and check guests in."
      footer={
        <p>
          Have an account?{' '}
          <Link to="/login" className={authLinkClass}>
            Sign in
          </Link>
        </p>
      }
    >
      <form method="post" onSubmit={onSubmit} className="space-y-4">
        <Field label="Your name">
          <Input name="name" autoComplete="name" autoCapitalize="words" required />
        </Field>
        <Field label="Email">
          <Input type="email" name="email" inputMode="email" autoComplete="email" autoCapitalize="none" required />
        </Field>
        <Field label="Password" hint={`At least ${MIN_LENGTH} characters.`}>
          <Input type="password" name="password" autoComplete="new-password" minLength={MIN_LENGTH} required />
        </Field>
        {error && <Alert tone="red">{error}</Alert>}
        <Button type="submit" size="lg" className="w-full" disabled={!hydrated || pending}>
          {pending && <Spinner />} Create account
        </Button>
      </form>
    </AuthCard>
  )
}
