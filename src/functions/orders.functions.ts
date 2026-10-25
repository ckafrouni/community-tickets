import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { buyerSchema, eventIdSchema, saleSchema } from '#/lib/schemas'
import type { EmailStatus, OrderDetail } from '#/lib/types'
import { requireEventAccess } from '#/server/access.server'
import { sendTicketEmail } from '#/server/email.server'
import { authMiddleware } from '#/server/middleware'
import { qrSvg } from '#/server/qr.server'
import {
  createOrder,
  getOrder,
  getOrderTickets,
  getStats,
  listOrders,
  setOrderCancelled,
  updateOrderBuyer,
} from '#/server/repo.server'
import { getBaseUrl } from '#/server/request.server'
import { ticketUrl } from '#/server/tickets.server'

const orderRef = eventIdSchema.extend({ id: z.number().int().positive() })

export const createSaleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(saleSchema.extend(eventIdSchema.shape))
  .handler(async ({ data, context }) => {
    const { event } = await requireEventAccess(context.user, data.eventId, 'host')
    const orderId = await createOrder(event.id, data, event.currency)
    let email: { status: EmailStatus; error?: string } = { status: 'not_sent' }
    if (data.sendEmail && data.buyerEmail) {
      email = await sendTicketEmail(event.id, orderId, getBaseUrl())
    }
    return { orderId, email }
  })

export const listOrdersFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(eventIdSchema.extend({ q: z.string().max(200) }))
  .handler(async ({ data, context }) => {
    const { event } = await requireEventAccess(context.user, data.eventId, 'host')
    const [orders, stats] = await Promise.all([listOrders(event.id, data.q), getStats(event.id)])
    return { orders, stats, currency: event.currency }
  })

export const getOrderFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(orderRef)
  .handler(async ({ data, context }): Promise<OrderDetail> => {
    await requireEventAccess(context.user, data.eventId, 'host')
    const order = await getOrder(data.eventId, data.id)
    if (!order) throw notFound()
    const baseUrl = getBaseUrl()
    const tickets = await Promise.all(
      (await getOrderTickets(order.id)).map(async (t) => {
        const url = await ticketUrl(baseUrl, t.id)
        return { ...t, url, qrSvg: qrSvg(url) }
      }),
    )
    return { ...order, tickets }
  })

export const updateOrderFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(buyerSchema.extend(orderRef.shape))
  .handler(async ({ data: { eventId, id, ...buyer }, context }) => {
    await requireEventAccess(context.user, eventId, 'host')
    if (!(await getOrder(eventId, id))) throw new Error('Order not found')
    await updateOrderBuyer(eventId, id, buyer)
    return { ok: true }
  })

export const resendEmailFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(orderRef)
  .handler(async ({ data, context }) => {
    await requireEventAccess(context.user, data.eventId, 'host')
    return sendTicketEmail(data.eventId, data.id, getBaseUrl())
  })

export const setOrderCancelledFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(orderRef.extend({ cancelled: z.boolean(), reason: z.string().trim().max(300) }))
  .handler(async ({ data, context }) => {
    await requireEventAccess(context.user, data.eventId, 'host')
    if (!(await getOrder(data.eventId, data.id))) throw new Error('Order not found')
    await setOrderCancelled(data.eventId, data.id, data.cancelled, data.reason)
    return { ok: true }
  })
