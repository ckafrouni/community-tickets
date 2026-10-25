import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { normalizeCode } from '#/lib/format'
import type { CheckInResult } from '#/lib/types'
import { staffMiddleware } from '#/server/middleware'
import {
  checkInRemaining,
  checkInTicket,
  getStats,
  getTicket,
  recentCheckIns,
  searchTickets,
  undoCheckIn,
} from '#/server/repo.server'
import { verifyTicket } from '#/server/tickets.server'

const ticketIdSchema = z.object({ ticketId: z.string().min(1).max(64) })

/** Verify a scanned QR token and check the ticket in (exactly once). */
export const scanTicketFn = createServerFn({ method: 'POST' })
  .middleware([staffMiddleware])
  .validator(z.object({ token: z.string().max(200) }))
  .handler(async ({ data, context }): Promise<CheckInResult> => {
    const ticketId = await verifyTicket(data.token)
    if (!ticketId) {
      return { status: 'invalid', reason: 'This QR code is not a genuine ticket (signature check failed).' }
    }
    return checkInTicket(ticketId, context.session.name)
  })

/** Manual check-in from the search list (staff only). */
export const checkInTicketFn = createServerFn({ method: 'POST' })
  .middleware([staffMiddleware])
  .validator(ticketIdSchema)
  .handler(({ data, context }) => checkInTicket(data.ticketId, context.session.name))

export const checkInRemainingFn = createServerFn({ method: 'POST' })
  .middleware([staffMiddleware])
  .validator(z.object({ orderId: z.number().int().positive() }))
  .handler(async ({ data, context }) => ({ count: await checkInRemaining(data.orderId, context.session.name) }))

export const undoCheckInFn = createServerFn({ method: 'POST' })
  .middleware([staffMiddleware])
  .validator(ticketIdSchema)
  .handler(async ({ data }) => {
    if (!(await getTicket(data.ticketId))) throw new Error('Ticket not found')
    await undoCheckIn(data.ticketId)
    return { ok: true }
  })

export const searchTicketsFn = createServerFn({ method: 'GET' })
  .middleware([staffMiddleware])
  .validator(z.object({ q: z.string().trim().min(1).max(100) }))
  .handler(({ data }) => searchTickets(data.q, normalizeCode(data.q)))

export const doorOverviewFn = createServerFn({ method: 'GET' })
  .middleware([staffMiddleware])
  .handler(async () => {
    const [stats, recent] = await Promise.all([getStats(), recentCheckIns()])
    return { checkedIn: stats.checkedIn, ticketsSold: stats.ticketsSold, recent }
  })
