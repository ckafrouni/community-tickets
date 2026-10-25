import { createServerFn } from '@tanstack/react-start'
import { ensureDefaultAdmin, getSessionUser } from '#/server/auth/auth.server'

export const getSessionFn = createServerFn({ method: 'GET' }).handler(() => getSessionUser())

export const getLoginStatusFn = createServerFn({ method: 'GET' }).handler(async () => {
  await ensureDefaultAdmin()
  return { signedIn: (await getSessionUser()) !== null }
})
