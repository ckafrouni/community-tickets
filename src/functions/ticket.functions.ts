import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import { getEventAccess } from '#/server/access.server'
import { getSessionUser } from '#/server/auth/auth.server'
import { qrSvg } from '#/server/qr.server'
import { getEvent, getTicket } from '#/server/repo.server'
import { getBaseUrl } from '#/server/request.server'
import { ticketUrl, verifyTicket } from '#/server/tickets.server'

export const getPublicTicketFn = createServerFn({ method: 'GET' })
  .validator(z.object({ token: z.string().max(200) }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    setResponseHeader('X-Robots-Tag', 'noindex')
    const ticketId = await verifyTicket(data.token)
    const ticket = ticketId ? await getTicket(ticketId) : null
    const event = ticket ? await getEvent(ticket.eventId) : null
    if (!ticket || !event) return { valid: false as const }

    const user = await getSessionUser()
    const access = user ? await getEventAccess(user, event.id) : null
    return {
      valid: true as const,
      event: { name: event.name, startsAt: event.startsAt, venue: event.venue, info: event.info },
      ticket: {
        code: ticket.code,
        seq: ticket.seq,
        quantity: ticket.quantity,
        orderId: ticket.orderId,
        buyerName: ticket.buyerName,
        typeName: ticket.typeName,
        checkedInAt: ticket.checkedInAt,
        cancelled: ticket.cancelled,
        paid: ticket.paid,
      },
      qrSvg: ticket.paid ? qrSvg(await ticketUrl(getBaseUrl(), ticket.id)) : '',
      staff: access ? { eventId: event.id, ticketId: ticket.id } : null,
    }
  })
