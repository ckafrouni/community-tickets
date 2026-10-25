import { Link, createFileRoute, useHydrated } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthCard, authLinkClass } from '#/components/AuthCard'
import { Button } from '#/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { getLoginStatusFn } from '#/functions/auth.functions'
import { authClient } from '#/lib/auth-client'
import { authErrorMessage, formText } from '#/lib/form'

export const Route = createFileRoute('/forgot-password')({
  loader: () => getLoginStatusFn(),
  head: () => ({ meta: [{ title: 'Mot de passe oublié · Community Tickets' }] }),
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
    if (error) setError(authErrorMessage(error, 'Une erreur est survenue. Réessayez.'))
    else setSentTo(email)
  }

  return (
    <AuthCard
      title={sentTo ? 'Vérifiez votre boîte mail' : 'Mot de passe oublié'}
      subtitle={sentTo ? undefined : 'Nous vous enverrons un lien pour en choisir un nouveau.'}
      footer={
        <p>
          <Link to="/login" className={authLinkClass}>
            Retour à la connexion
          </Link>
        </p>
      }
    >
      {sentTo ? (
        <p className="text-[15px] text-muted-foreground">
          Si {sentTo} a un compte, un lien arrivera d’ici une minute. Il est valable 24 heures. Introuvable ? Regardez
          dans les spams.
        </p>
      ) : (
        <form method="post" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="forgot-email">E-mail</FieldLabel>
              <Input
                id="forgot-email"
                type="email"
                name="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                required
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" size="lg" disabled={!hydrated || pending}>
              {pending && <Spinner />} M’envoyer un lien
            </Button>
          </FieldGroup>
        </form>
      )}
    </AuthCard>
  )
}
