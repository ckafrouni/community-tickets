import { Link, createFileRoute, redirect, useHydrated } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { AuthCard, authLinkClass } from '#/components/AuthCard'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { getLoginStatusFn } from '#/functions/auth.functions'
import { authClient } from '#/lib/auth-client'
import { authErrorMessage, formText } from '#/lib/form'

const MIN_LENGTH = 10

export const Route = createFileRoute('/signup')({
  loader: async () => {
    if ((await getLoginStatusFn()).signedIn) throw redirect({ to: '/events' })
  },
  head: () => ({ meta: [{ title: 'Créer un compte · Community Tickets' }] }),
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
      setError(authErrorMessage(error, 'Impossible de créer le compte. Réessayez.'))
      return
    }
    setSentTo(email)
  }

  if (sentTo) {
    return (
      <AuthCard
        title="Vérifiez votre boîte mail"
        subtitle={`Nous avons envoyé un lien à ${sentTo}.`}
        footer={
          <p>
            Déjà confirmé ?{' '}
            <Link to="/login" className={authLinkClass}>
              Sign in
            </Link>
          </p>
        }
      >
        <p className="text-[15px] text-muted-foreground">
          Ouvrez l’e-mail et appuyez sur <strong className="text-foreground">Confirmer mon e-mail</strong> pour terminer
          la création de votre compte. Le lien est valable 24 heures. Introuvable ? Regardez dans les spams.
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Créer un compte"
      subtitle="Organisez des événements, vendez des billets et accueillez vos invités."
      footer={
        <p>
          Déjà un compte ?{' '}
          <Link to="/login" className={authLinkClass}>
            Sign in
          </Link>
        </p>
      }
    >
      <form method="post" onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="signup-name">Votre nom</FieldLabel>
            <Input id="signup-name" name="name" autoComplete="name" autoCapitalize="words" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="signup-email">E-mail</FieldLabel>
            <Input
              id="signup-email"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="signup-password">Mot de passe</FieldLabel>
            <Input
              id="signup-password"
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              required
            />
            <FieldDescription>Au moins {MIN_LENGTH} caractères.</FieldDescription>
          </Field>
          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" disabled={!hydrated || pending}>
            {pending && <Spinner />} Créer mon compte
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
