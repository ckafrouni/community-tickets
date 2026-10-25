import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { buyerSchema, saleSchema } from '#/lib/schemas'
import type { EmailStatus, OrderDetail } from '#/lib/types'
import { sendTicketEmail } from '#/server/email.server'
import { adminMiddleware } from '#/server/middleware'
import { qrSvg } from '#/server/qr.server'
import {
  createOrder,
  getOrder,
  getOrderTickets,
  getSettings,
  getStats,
  listOrders,
  setOrderCancelled,
  updateOrderBuyer,
} from '#/server/repo.server'
import { getBaseUrl } from '#/server/request.server'
import { ticketUrl } from '#/server/tickets.server'

const orderIdSchema = z.object({ id: z.number().int().positive() })

export const createSaleFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(saleSchema)
  .handler(async ({ data }) => {
    const orderId = await createOrder(data, (await getSettings()).currency)
    let email: { status: EmailStatus; error?: string } = { status: 'not_sent' }
    if (data.sendEmail && data.buyerEmail) {
      email = await sendTicketEmail(orderId, getBaseUrl())
    }
    return { orderId, email }
  })

export const listOrdersFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .validator(z.object({ q: z.string().max(200) }))
  .handler(async ({ data }) => {
    const [orders, stats, settings] = await Promise.all([listOrders(data.q), getStats(), getSettings()])
    return { orders, stats, currency: settings.currency }
  })

export const getOrderFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .validator(orderIdSchema)
  .handler(async ({ data }): Promise<OrderDetail> => {
    const order = await getOrder(data.id)
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
  .middleware([adminMiddleware])
  .validator(buyerSchema.extend(orderIdSchema.shape))
  .handler(async ({ data }) => {
    if (!(await getOrder(data.id))) throw new Error('Order not found')
    await updateOrderBuyer(data.id, data)
    return { ok: true }
  })

export const resendEmailFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(orderIdSchema)
  .handler(({ data }) => sendTicketEmail(data.id, getBaseUrl()))

export const setOrderCancelledFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(orderIdSchema.extend({ cancelled: z.boolean(), reason: z.string().trim().max(300) }))
  .handler(async ({ data }) => {
    if (!(await getOrder(data.id))) throw new Error('Order not found')
    await setOrderCancelled(data.id, data.cancelled, data.reason)
    return { ok: true }
  })
