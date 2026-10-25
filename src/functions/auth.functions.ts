import { createServerFn } from '@tanstack/react-start'
import { ensureDefaultAdmin, getStaffSession } from '#/server/auth/auth.server'
import { getSettings } from '#/server/repo.server'

export const getSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getStaffSession()
  if (!session) return null
  return { ...session, eventName: (await getSettings()).eventName }
})

export const getLoginStatusFn = createServerFn({ method: 'GET' }).handler(async () => {
  await ensureDefaultAdmin()
  const [session, settings] = await Promise.all([getStaffSession(), getSettings()])
  return { role: session?.role ?? null, eventName: settings.eventName }
})
