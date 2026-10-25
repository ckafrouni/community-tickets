import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { paymentReference, paymentStatus } from '#/lib/payments'
import { buyerSchema, eventIdSchema, paymentSchema, saleSchema } from '#/lib/schemas'
import type { OrderDetail } from '#/lib/types'
import { requireEventAccess } from '#/server/access.server'
import { sendOrderEmail, sendTicketEmail } from '#/server/email.server'
import { authMiddleware } from '#/server/middleware'
import { qrSvg } from '#/server/qr.server'
import {
  addPayment,
  createOrder,
  deletePayment,
  getOrder,
  getOrderTickets,
  getStats,
  listOrders,
  listPayments,
  listTicketTypes,
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
    const { event } = await requireEventAccess(context.user, data.eventId, 'organizer')
    const types = new Map((await listTicketTypes(event.id)).map((type) => [type.id, type]))
    const lines = data.items.filter((item) => item.quantity > 0)
    if (lines.some((line) => !types.has(line.ticketTypeId))) {
      throw new Error('Un tarif a été modifié entre-temps. Rechargez la page.')
    }
    const total = lines.reduce((sum, line) => sum + types.get(line.ticketTypeId)!.price * line.quantity, 0)
    const orderId = await createOrder(event.id, {
      buyer: {
        buyerName: data.buyerName,
        buyerEmail: data.buyerEmail,
        buyerPhone: data.buyerPhone,
        notes: data.notes,
      },
      lines,
      total,
      currency: event.currency,
      payment: data.received > 0 ? { amount: data.received, method: data.method, recordedBy: context.user.name } : null,
    })
    const email = await sendOrderEmail(event.id, orderId, getBaseUrl())
    return { orderId, email }
  })

export const listOrdersFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(eventIdSchema.extend({ q: z.string().max(200) }))
  .handler(async ({ data, context }) => {
    const { event } = await requireEventAccess(context.user, data.eventId, 'organizer')
    const [orders, stats] = await Promise.all([listOrders(event.id, data.q), getStats(event.id)])
    return { orders, stats, currency: event.currency }
  })

export const getOrderFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(orderRef)
  .handler(async ({ data, context }): Promise<OrderDetail> => {
    await requireEventAccess(context.user, data.eventId, 'organizer')
    const order = await getOrder(data.eventId, data.id)
    if (!order) throw notFound()
    const baseUrl = getBaseUrl()
    const [orderTickets, payments] = await Promise.all([getOrderTickets(order.id), listPayments(order.id)])
    const tickets = await Promise.all(
      orderTickets.map(async (t) => {
        const url = await ticketUrl(baseUrl, t.id)
        return { ...t, url, qrSvg: qrSvg(url) }
      }),
    )
    return { ...order, tickets, payments, reference: paymentReference(order.id) }
  })

export const updateOrderFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(buyerSchema.extend(orderRef.shape))
  .handler(async ({ data: { eventId, id, ...buyer }, context }) => {
    await requireEventAccess(context.user, eventId, 'organizer')
    if (!(await getOrder(eventId, id))) throw new Error('Commande introuvable')
    await updateOrderBuyer(eventId, id, buyer)
    return { ok: true }
  })

export const resendEmailFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(orderRef)
  .handler(async ({ data, context }) => {
    await requireEventAccess(context.user, data.eventId, 'organizer')
    return sendOrderEmail(data.eventId, data.id, getBaseUrl())
  })

export const recordPaymentFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(paymentSchema.extend(orderRef.shape))
  .handler(async ({ data: { eventId, id, ...payment }, context }) => {
    await requireEventAccess(context.user, eventId, 'organizer')
    const order = await getOrder(eventId, id)
    if (!order) throw new Error('Commande introuvable')
    if (order.cancelledAt) throw new Error('Cette commande est annulée')
    await addPayment(order.id, { ...payment, recordedBy: context.user.name })
    const updated = (await getOrder(eventId, id))!
    const status = paymentStatus(updated)
    const email = status === 'paid' && !updated.ticketsSentAt ? await sendTicketEmail(eventId, id, getBaseUrl()) : null
    return { status, remaining: Math.max(updated.amount - updated.paid, 0), email }
  })

export const deletePaymentFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(eventIdSchema.extend({ paymentId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    await requireEventAccess(context.user, data.eventId, 'organizer')
    if (!(await deletePayment(data.eventId, data.paymentId))) throw new Error('Paiement introuvable')
    return { ok: true }
  })

export const setOrderCancelledFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(orderRef.extend({ cancelled: z.boolean(), reason: z.string().trim().max(300) }))
  .handler(async ({ data, context }) => {
    await requireEventAccess(context.user, data.eventId, 'organizer')
    if (!(await getOrder(data.eventId, data.id))) throw new Error('Commande introuvable')
    await setOrderCancelled(data.eventId, data.id, data.cancelled, data.reason)
    return { ok: true }
  })
