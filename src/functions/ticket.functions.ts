import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import { getStaffSession } from '#/server/auth/auth.server'
import { qrSvg } from '#/server/qr.server'
import { getSettings, getTicket } from '#/server/repo.server'
import { getBaseUrl } from '#/server/request.server'
import { ticketUrl, verifyTicket } from '#/server/tickets.server'

/** Public ticket page data. Only reachable with a correctly signed token. */
export const getPublicTicketFn = createServerFn({ method: 'GET' })
  .validator(z.object({ token: z.string().max(200) }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    setResponseHeader('X-Robots-Tag', 'noindex')
    const ticketId = await verifyTicket(data.token)
    const ticket = ticketId ? await getTicket(ticketId) : null
    if (!ticket) return { valid: false as const }

    const [settings, session] = await Promise.all([getSettings(), getStaffSession()])
    return {
      valid: true as const,
      event: {
        name: settings.eventName,
        date: settings.eventDate,
        venue: settings.eventVenue,
        info: settings.eventInfo,
      },
      ticket: {
        code: ticket.code,
        seq: ticket.seq,
        quantity: ticket.quantity,
        orderId: ticket.orderId,
        buyerName: ticket.buyerName,
        checkedInAt: ticket.checkedInAt,
        cancelled: ticket.cancelled,
      },
      qrSvg: qrSvg(await ticketUrl(getBaseUrl(), ticket.id)),
      // Staff who open a ticket link (e.g. with their phone camera) get check-in controls.
      staff: session ? { role: session.role, ticketId: ticket.id } : null,
    }
  })
