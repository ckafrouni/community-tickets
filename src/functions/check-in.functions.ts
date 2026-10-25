import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { normalizeCode } from '#/lib/format'
import { eventIdSchema } from '#/lib/schemas'
import type { CheckInResult } from '#/lib/types'
import { requireEventAccess } from '#/server/access.server'
import { authMiddleware } from '#/server/middleware'
import {
  checkInRemaining,
  checkInTicket,
  getStats,
  recentCheckIns,
  searchTickets,
  undoCheckIn,
} from '#/server/repo.server'
import { verifyTicket } from '#/server/tickets.server'

const ticketRef = eventIdSchema.extend({ ticketId: z.string().min(1).max(64) })

export const scanTicketFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(eventIdSchema.extend({ token: z.string().max(200) }))
  .handler(async ({ data, context }): Promise<CheckInResult> => {
    await requireEventAccess(context.user, data.eventId, 'volunteer')
    const ticketId = await verifyTicket(data.token)
    if (!ticketId) {
      return { status: 'invalid', reason: 'This QR code is not a genuine ticket (signature check failed).' }
    }
    return checkInTicket(data.eventId, ticketId, context.user.name)
  })

export const checkInTicketFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(ticketRef)
  .handler(async ({ data, context }) => {
    await requireEventAccess(context.user, data.eventId, 'volunteer')
    return checkInTicket(data.eventId, data.ticketId, context.user.name)
  })

export const checkInRemainingFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(eventIdSchema.extend({ orderId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    await requireEventAccess(context.user, data.eventId, 'volunteer')
    return { count: await checkInRemaining(data.eventId, data.orderId, context.user.name) }
  })

export const undoCheckInFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(ticketRef)
  .handler(async ({ data, context }) => {
    await requireEventAccess(context.user, data.eventId, 'volunteer')
    if (!(await undoCheckIn(data.eventId, data.ticketId))) throw new Error('Ticket not found')
    return { ok: true }
  })

export const searchTicketsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(eventIdSchema.extend({ q: z.string().trim().min(1).max(100) }))
  .handler(async ({ data, context }) => {
    await requireEventAccess(context.user, data.eventId, 'volunteer')
    return searchTickets(data.eventId, data.q, normalizeCode(data.q))
  })

export const checkInOverviewFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(eventIdSchema)
  .handler(async ({ data, context }) => {
    await requireEventAccess(context.user, data.eventId, 'volunteer')
    const [stats, recent] = await Promise.all([getStats(data.eventId), recentCheckIns(data.eventId)])
    return { checkedIn: stats.checkedIn, ticketsSold: stats.ticketsSold, recent }
  })
