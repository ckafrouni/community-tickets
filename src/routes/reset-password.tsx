import { Link, createFileRoute, useHydrated, useNavigate } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { AuthCard, authLinkClass } from '#/components/AuthCard'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { authClient } from '#/lib/auth-client'
import { formText } from '#/lib/form'

const MIN_LENGTH = 10

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
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const hydrated = useHydrated()

  if (!token || linkError) {
    return (
      <AuthCard
        title="This link has expired"
        footer={
          <p>
            <Link to="/forgot-password" className={authLinkClass}>
              Send me a new link
            </Link>
          </p>
        }
      >
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>The link is invalid or older than 24 hours. Request a new one.</AlertDescription>
        </Alert>
      </AuthCard>
    )
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = formText(form, 'password')
    if (password !== formText(form, 'confirm')) {
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
    <AuthCard title="Choose a password" subtitle={`At least ${MIN_LENGTH} characters.`}>
      <form method="post" onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="new-password">New password</FieldLabel>
            <Input
              id="new-password"
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
            <Input
              id="confirm-password"
              type="password"
              name="confirm"
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              required
            />
          </Field>
          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" disabled={!hydrated || pending}>
            {pending && <Spinner />} Save password
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
