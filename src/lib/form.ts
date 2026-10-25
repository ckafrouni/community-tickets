export function formText(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}

const AUTH_ERRORS: Record<string, string> = {
  USER_ALREADY_EXISTS: 'Un compte existe déjà avec cet e-mail. Connectez-vous ou réinitialisez le mot de passe.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    'Un compte existe déjà avec cet e-mail. Connectez-vous ou réinitialisez le mot de passe.',
  PASSWORD_TOO_SHORT: 'Le mot de passe est trop court.',
  PASSWORD_TOO_LONG: 'Le mot de passe est trop long.',
  INVALID_EMAIL: 'Saisissez une adresse e-mail valide.',
  INVALID_TOKEN: 'Le lien est invalide ou a expiré. Demandez-en un nouveau.',
}

export function authErrorMessage(error: { code?: string; status?: number; message?: string }, fallback: string) {
  if (error.status === 429) return 'Trop de tentatives. Patientez une minute puis réessayez.'
  return (error.code && AUTH_ERRORS[error.code]) || fallback
}
