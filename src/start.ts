import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

const securityHeadersMiddleware = createMiddleware().server(({ next }) => {
  setResponseHeader('X-Content-Type-Options', 'nosniff')
  setResponseHeader('X-Frame-Options', 'DENY')
  setResponseHeader('Referrer-Policy', 'no-referrer')
  setResponseHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')
  return next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, securityHeadersMiddleware],
}))
