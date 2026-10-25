import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { parseRole } from '#/lib/permissions'
import { auth } from '#/server/auth/auth.server'
import { randomToken } from '#/server/crypto.server'
import { adminMiddleware } from '#/server/middleware'

const RESET_REDIRECT = '/reset-password'

export type StaffMember = {
  id: string
  name: string
  email: string
  role: 'admin' | 'door'
  createdAt: string
}

export const listStaffFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    const { users } = await auth.api.listUsers({
      query: { limit: 200, sortBy: 'createdAt', sortDirection: 'asc' },
      headers: getRequestHeaders(),
    })
    const staff: StaffMember[] = users.flatMap((u) => {
      const role = parseRole(u.role)
      return role
        ? [{ id: u.id, name: u.name, email: u.email, role, createdAt: new Date(u.createdAt).toISOString() }]
        : []
    })
    return { staff, currentUserId: context.session.userId }
  })

export const addStaffFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      name: z.string().trim().min(1, 'Name is required').max(120),
      email: z.email('Enter a valid email address').trim().toLowerCase(),
      role: z.enum(['admin', 'door']),
    }),
  )
  .handler(async ({ data }) => {
    await auth.api.createUser({
      body: {
        name: data.name,
        email: data.email,
        role: data.role,
        password: randomToken(),
        data: { emailVerified: true },
      },
      headers: getRequestHeaders(),
    })
    await auth.api.requestPasswordReset({ body: { email: data.email, redirectTo: RESET_REDIRECT } })
    return { ok: true }
  })

export const sendPasswordLinkFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(z.object({ email: z.email() }))
  .handler(async ({ data }) => {
    await auth.api.requestPasswordReset({ body: { email: data.email, redirectTo: RESET_REDIRECT } })
    return { ok: true }
  })

export const removeStaffFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    if (data.userId === context.session.userId) throw new Error("You can't remove your own account.")
    await auth.api.removeUser({ body: { userId: data.userId }, headers: getRequestHeaders() })
    return { ok: true }
  })
