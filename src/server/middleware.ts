import { createMiddleware } from '@tanstack/react-start'
import { setResponseHeader, setResponseStatus } from '@tanstack/react-start/server'
import { getSessionUser } from './auth/auth.server'

export const authMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const user = await getSessionUser()
  if (!user) {
    setResponseStatus(401)
    throw new Error('Votre session a expiré. Reconnectez-vous.')
  }
  setResponseHeader('Cache-Control', 'no-store')
  return next({ context: { user } })
})
