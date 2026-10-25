import { createMiddleware } from '@tanstack/react-start'
import { setResponseHeader, setResponseStatus } from '@tanstack/react-start/server'
import { getStaffSession } from './auth/auth.server'

// Attach to every server function that needs a signed-in user. Route guards
// only control navigation; these are the actual security boundary.

export const staffMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await getStaffSession()
  if (!session) {
    setResponseStatus(401)
    throw new Error('Your session has expired. Please sign in again.')
  }
  setResponseHeader('Cache-Control', 'no-store')
  return next({ context: { session } })
})

export const adminMiddleware = createMiddleware({ type: 'function' })
  .middleware([staffMiddleware])
  .server(async ({ next, context }) => {
    if (context.session.role !== 'admin') {
      setResponseStatus(403)
      throw new Error('Only organizers can do this.')
    }
    return next()
  })
