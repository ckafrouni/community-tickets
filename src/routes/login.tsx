import { Link, createFileRoute, redirect, useHydrated, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthCard, authLinkClass } from '#/components/AuthCard'
import { Button } from '#/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
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
  head: () => ({ meta: [{ title: 'Connexion · Community Tickets' }] }),
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
          ? 'Confirmez d’abord votre e-mail. Nous venons de vous renvoyer un lien.'
          : error.status === 429
            ? (error.message ?? 'Trop de tentatives. Patientez une minute.')
            : 'E-mail ou mot de passe incorrect.',
      )
      setPending(false)
      return
    }
    await router.invalidate()
    await router.navigate({ href: search.redirect ?? '/events' })
  }

  return (
    <AuthCard
      title="Bon retour"
      subtitle={
        search.passwordSet
          ? 'Votre mot de passe est enregistré. Connectez-vous ci-dessous.'
          : 'Connectez-vous pour gérer vos événements.'
      }
      footer={
        <p>
          Pas encore de compte ?{' '}
          <Link to="/signup" className={authLinkClass}>
            Créer un compte
          </Link>
        </p>
      }
    >
      <form method="post" onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="login-email">E-mail</FieldLabel>
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
            <FieldLabel htmlFor="login-password">Mot de passe</FieldLabel>
            <Input id="login-password" type="password" name="password" autoComplete="current-password" required />
          </Field>
          {error && <FieldError>{error}</FieldError>}
          <Button type="submit" size="lg" disabled={!hydrated || pending}>
            {pending && <Spinner />} Se connecter
          </Button>
          <Link to="/forgot-password" className="text-center text-sm text-muted-foreground hover:text-foreground">
            Mot de passe oublié ?
          </Link>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
