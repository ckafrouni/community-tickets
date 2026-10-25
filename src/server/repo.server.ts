import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  getColumns,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { alias, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { EventInput, TicketTypeInput } from '#/lib/schemas'
import type {
  CheckInResult,
  EmailStatus,
  EventDetails,
  EventListItem,
  EventMember,
  EventRole,
  OrderSummary,
  Payment,
  PaymentMethod,
  SalesStats,
  TicketSummary,
  TicketType,
} from '#/lib/types'
import { randomCode, randomEventId, randomTicketId } from './crypto.server'
import { db } from './db/client.server'
import { eventMembers, events, orders, payments, tickets, ticketTypes, user } from './db/schema'

const nowIso = () => new Date().toISOString()

function contains(column: AnySQLiteColumn, query: string): SQL {
  const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`
}

function orderNumber(q: string) {
  const match = /^(?:#|ct|n°\s*)?(\d+)$/i.exec(q.trim())
  return match ? Number(match[1]) : -1
}

const isActiveOrder = isNull(orders.cancelledAt)

const paidSql = sql<number>`(SELECT coalesce(sum(${payments.amount}), 0) FROM ${payments} WHERE ${payments.orderId} = ${orders.id})`
const isFullyPaid = sql`${paidSql} >= ${orders.amount}`

function activeOrderOf(orderId: AnySQLiteColumn, eventId: string) {
  return db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.eventId, eventId), isActiveOrder, isFullyPaid))
}

function ordersOf(eventId: string) {
  return db.select({ id: orders.id }).from(orders).where(eq(orders.eventId, eventId))
}

const eventFields = {
  id: events.id,
  name: events.name,
  startsAt: events.startsAt,
  venue: events.venue,
  info: events.info,
  currency: events.currency,
  contactEmail: events.contactEmail,
  bankDetails: events.bankDetails,
}

export async function createEvent(input: EventInput, types: TicketTypeInput[], userId: string): Promise<string> {
  const id = randomEventId()
  const createdAt = nowIso()
  await db.batch([
    db.insert(events).values({ id, ...input, createdBy: userId, createdAt }),
    db.insert(eventMembers).values({ eventId: id, userId, role: 'organizer', createdAt }),
    db
      .insert(ticketTypes)
      .values(
        types.map((type, position) => ({ eventId: id, name: type.name, price: type.price, position, createdAt })),
      ),
  ])
  return id
}

export async function getEvent(id: string): Promise<EventDetails | null> {
  const [row] = await db.select(eventFields).from(events).where(eq(events.id, id))
  return row ?? null
}

export async function updateEvent(id: string, input: EventInput) {
  await db.update(events).set(input).where(eq(events.id, id))
}

export async function listEventsForUser(userId: string, isAdmin: boolean): Promise<EventListItem[]> {
  const sold = db
    .select({ n: sql<number>`coalesce(sum(${orders.quantity}), 0)` })
    .from(orders)
    .where(and(eq(orders.eventId, events.id), isActiveOrder))
  const arrived = db
    .select({ n: count() })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .where(and(eq(orders.eventId, events.id), isActiveOrder, isNotNull(tickets.checkedInAt)))
  const membership = and(eq(eventMembers.eventId, events.id), eq(eventMembers.userId, userId))
  const query = db
    .select({
      ...eventFields,
      role: sql<EventRole>`coalesce(${eventMembers.role}, 'organizer')`,
      ticketsSold: sql<number>`(${sold})`.mapWith(Number),
      checkedIn: sql<number>`(${arrived})`.mapWith(Number),
    })
    .from(events)
  return (isAdmin ? query.leftJoin(eventMembers, membership) : query.innerJoin(eventMembers, membership))
    .orderBy(asc(events.startsAt), desc(events.createdAt))
    .limit(500)
}

export async function listTicketTypes(eventId: string): Promise<TicketType[]> {
  const sold = db
    .select({ n: count() })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .where(and(eq(tickets.ticketTypeId, ticketTypes.id), isActiveOrder))
  return db
    .select({
      id: ticketTypes.id,
      name: ticketTypes.name,
      price: ticketTypes.price,
      sold: sql<number>`(${sold})`.mapWith(Number),
    })
    .from(ticketTypes)
    .where(and(eq(ticketTypes.eventId, eventId), isNull(ticketTypes.archivedAt)))
    .orderBy(asc(ticketTypes.position), asc(ticketTypes.id))
}

export async function saveTicketTypes(eventId: string, inputs: TicketTypeInput[]) {
  const existing = await db
    .select({
      id: ticketTypes.id,
      used: sql<number>`(SELECT count(*) FROM ${tickets} WHERE ${tickets.ticketTypeId} = ${ticketTypes.id})`.mapWith(
        Number,
      ),
    })
    .from(ticketTypes)
    .where(eq(ticketTypes.eventId, eventId))
  const known = new Map(existing.map((type) => [type.id, type]))
  const kept = new Set(inputs.flatMap((input) => (input.id && known.has(input.id) ? [input.id] : [])))
  const now = nowIso()
  const statements = [
    ...inputs.map((input, position) =>
      input.id && known.has(input.id)
        ? db
            .update(ticketTypes)
            .set({ name: input.name, price: input.price, position, archivedAt: null })
            .where(eq(ticketTypes.id, input.id))
        : db.insert(ticketTypes).values({ eventId, name: input.name, price: input.price, position, createdAt: now }),
    ),
    ...existing
      .filter((type) => !kept.has(type.id))
      .map((type) =>
        type.used > 0
          ? db.update(ticketTypes).set({ archivedAt: now }).where(eq(ticketTypes.id, type.id))
          : db.delete(ticketTypes).where(eq(ticketTypes.id, type.id)),
      ),
  ]
  const [first, ...rest] = statements
  if (first) await db.batch([first, ...rest])
}

export async function getMemberRole(eventId: string, userId: string): Promise<EventRole | null> {
  const row = await db.query.eventMembers.findFirst({ columns: { role: true }, where: { eventId, userId } })
  return row?.role ?? null
}

export function listMembers(eventId: string): Promise<EventMember[]> {
  return db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: eventMembers.role,
      createdAt: eventMembers.createdAt,
    })
    .from(eventMembers)
    .innerJoin(user, eq(user.id, eventMembers.userId))
    .where(eq(eventMembers.eventId, eventId))
    .orderBy(asc(eventMembers.createdAt))
}

export async function addMember(eventId: string, userId: string, role: EventRole) {
  await db
    .insert(eventMembers)
    .values({ eventId, userId, role, createdAt: nowIso() })
    .onConflictDoUpdate({ target: [eventMembers.eventId, eventMembers.userId], set: { role } })
}

export async function removeMember(eventId: string, userId: string) {
  await db.delete(eventMembers).where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)))
}

export function countOrganizers(eventId: string): Promise<number> {
  return db.$count(eventMembers, and(eq(eventMembers.eventId, eventId), eq(eventMembers.role, 'organizer')))
}

export async function findUserByEmail(email: string) {
  return (await db.query.user.findFirst({ columns: { id: true, name: true, email: true }, where: { email } })) ?? null
}

const orderFields = {
  ...getColumns(orders),
  paid: paidSql.mapWith(Number),
  checkedIn: db.$count(tickets, and(eq(tickets.orderId, orders.id), isNotNull(tickets.checkedInAt))),
}

export type SaleLine = { ticketTypeId: number; quantity: number }

export type NewOrder = {
  buyer: { buyerName: string; buyerEmail: string; buyerPhone: string; notes: string }
  lines: SaleLine[]
  total: number
  currency: string
  payment: { amount: number; method: PaymentMethod; recordedBy: string } | null
}

export async function createOrder(eventId: string, order: NewOrder): Promise<number> {
  const createdAt = nowIso()
  const quantity = order.lines.reduce((sum, line) => sum + line.quantity, 0)
  const lastOrderId = sql`(SELECT MAX(${orders.id}) FROM ${orders})`
  for (let attempt = 0; ; attempt++) {
    const seats = order.lines.flatMap((line) => Array.from({ length: line.quantity }, () => line.ticketTypeId))
    const insertOrder = db
      .insert(orders)
      .values({ eventId, ...order.buyer, quantity, amount: order.total, currency: order.currency, createdAt })
      .returning({ id: orders.id })
    const insertTickets = db.insert(tickets).values(
      seats.map((ticketTypeId, i) => ({
        id: randomTicketId(),
        code: randomCode(),
        // Safe: a D1 batch is one transaction, so MAX(id) is the order inserted just above.
        orderId: lastOrderId,
        ticketTypeId,
        seq: i + 1,
        createdAt,
      })),
    )
    try {
      const [[created]] = order.payment
        ? await db.batch([
            insertOrder,
            insertTickets,
            db.insert(payments).values({
              orderId: lastOrderId,
              amount: order.payment.amount,
              method: order.payment.method,
              receivedAt: createdAt,
              recordedBy: order.payment.recordedBy,
            }),
          ])
        : await db.batch([insertOrder, insertTickets])
      return created.id
    } catch (error) {
      if (attempt >= 3 || !isUniqueViolation(error)) throw error
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const cause = error.cause instanceof Error ? error.cause.message : ''
  return /UNIQUE/.test(`${error.message} ${cause}`)
}

const orderOf = (eventId: string, id: number) => and(eq(orders.id, id), eq(orders.eventId, eventId))

export async function getOrder(eventId: string, id: number): Promise<OrderSummary | null> {
  const [order] = await db.select(orderFields).from(orders).where(orderOf(eventId, id))
  return order ?? null
}

export async function listOrders(eventId: string, q: string): Promise<OrderSummary[]> {
  const query = q.trim()
  const code = query.toUpperCase().replace(/[^0-9A-Z]/g, '')
  const filter = query
    ? or(
        contains(orders.buyerName, query),
        contains(orders.buyerEmail, query),
        contains(orders.buyerPhone, query),
        contains(orders.notes, query),
        eq(orders.id, orderNumber(query)),
        exists(
          db
            .select({ id: tickets.id })
            .from(tickets)
            .where(and(eq(tickets.orderId, orders.id), eq(tickets.code, code))),
        ),
      )
    : undefined
  return db
    .select(orderFields)
    .from(orders)
    .where(and(eq(orders.eventId, eventId), filter))
    .orderBy(desc(orders.id))
}

export async function updateOrderBuyer(
  eventId: string,
  id: number,
  buyer: { buyerName: string; buyerEmail: string; buyerPhone: string; notes: string },
) {
  await db.update(orders).set(buyer).where(orderOf(eventId, id))
}

export async function setOrderCancelled(eventId: string, id: number, cancelled: boolean, reason = '') {
  await db
    .update(orders)
    .set({ cancelledAt: cancelled ? nowIso() : null, cancelReason: cancelled ? reason : '' })
    .where(orderOf(eventId, id))
}

export async function setEmailStatus(id: number, status: EmailStatus, error = '') {
  await db
    .update(orders)
    .set({ emailStatus: status, emailError: error.slice(0, 500), emailUpdatedAt: nowIso() })
    .where(eq(orders.id, id))
}

export async function markTicketsSent(id: number) {
  await db.update(orders).set({ ticketsSentAt: nowIso() }).where(eq(orders.id, id))
}

export function listPayments(orderId: number): Promise<Payment[]> {
  return db
    .select({
      id: payments.id,
      amount: payments.amount,
      method: payments.method,
      note: payments.note,
      receivedAt: payments.receivedAt,
      recordedBy: payments.recordedBy,
    })
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(asc(payments.receivedAt), asc(payments.id))
}

export async function addPayment(
  orderId: number,
  payment: { amount: number; method: PaymentMethod; note: string; recordedBy: string },
) {
  await db.insert(payments).values({ orderId, ...payment, receivedAt: nowIso() })
}

export async function deletePayment(eventId: string, paymentId: number): Promise<number | null> {
  const [deleted] = await db
    .delete(payments)
    .where(and(eq(payments.id, paymentId), inArray(payments.orderId, ordersOf(eventId))))
    .returning({ orderId: payments.orderId })
  return deleted?.orderId ?? null
}

export async function getStats(eventId: string): Promise<SalesStats> {
  const [[totals], checkedIn] = await Promise.all([
    db
      .select({
        orders: count(),
        ticketsSold: sql<number>`coalesce(sum(${orders.quantity}), 0)`.mapWith(Number),
        revenue: sql<number>`coalesce(sum(${paidSql}), 0)`.mapWith(Number),
        outstanding: sql<number>`coalesce(sum(max(${orders.amount} - ${paidSql}, 0)), 0)`.mapWith(Number),
      })
      .from(orders)
      .where(and(eq(orders.eventId, eventId), isActiveOrder)),
    db.$count(
      tickets,
      and(
        isNotNull(tickets.checkedInAt),
        exists(
          db
            .select({ id: orders.id })
            .from(orders)
            .where(and(eq(orders.id, tickets.orderId), eq(orders.eventId, eventId), isActiveOrder)),
        ),
      ),
    ),
  ])
  return { ...totals, checkedIn }
}

const sibling = alias(tickets, 'sibling')

const ticketFields = {
  id: tickets.id,
  eventId: orders.eventId,
  code: tickets.code,
  seq: tickets.seq,
  orderId: tickets.orderId,
  quantity: orders.quantity,
  buyerName: orders.buyerName,
  typeName: sql<string>`coalesce(${ticketTypes.name}, '')`,
  checkedInAt: tickets.checkedInAt,
  checkedInBy: tickets.checkedInBy,
  cancelled: sql<boolean>`${orders.cancelledAt} IS NOT NULL`.mapWith(Boolean),
  paid: sql<boolean>`${isFullyPaid}`.mapWith(Boolean),
  orderCheckedIn: sql<number>`(${db
    .select({ n: count() })
    .from(sibling)
    .where(and(eq(sibling.orderId, tickets.orderId), isNotNull(sibling.checkedInAt)))})`.mapWith(Number),
}

function selectTickets(where: SQL | undefined) {
  return db
    .select(ticketFields)
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .leftJoin(ticketTypes, eq(ticketTypes.id, tickets.ticketTypeId))
    .where(where)
}

export async function getTicket(id: string): Promise<TicketSummary | null> {
  const [ticket] = await selectTickets(eq(tickets.id, id))
  return ticket ?? null
}

export function getOrderTickets(orderId: number): Promise<TicketSummary[]> {
  return selectTickets(eq(tickets.orderId, orderId)).orderBy(asc(tickets.seq))
}

export function searchTickets(eventId: string, q: string, code: string): Promise<TicketSummary[]> {
  const query = q.trim()
  return selectTickets(
    and(
      eq(orders.eventId, eventId),
      or(
        contains(orders.buyerName, query),
        contains(orders.buyerEmail, query),
        contains(orders.buyerPhone, query),
        eq(tickets.code, code),
        eq(orders.id, orderNumber(query)),
      ),
    ),
  )
    .orderBy(sql`${orders.buyerName} COLLATE NOCASE`, asc(orders.id), asc(tickets.seq))
    .limit(40)
}

export function recentCheckIns(eventId: string, limit = 8): Promise<TicketSummary[]> {
  return selectTickets(and(eq(orders.eventId, eventId), isNotNull(tickets.checkedInAt)))
    .orderBy(desc(tickets.checkedInAt))
    .limit(limit)
}

export async function checkInTicket(eventId: string, ticketId: string, by: string): Promise<CheckInResult> {
  const updated = await db
    .update(tickets)
    .set({ checkedInAt: nowIso(), checkedInBy: by })
    .where(and(eq(tickets.id, ticketId), isNull(tickets.checkedInAt), exists(activeOrderOf(tickets.orderId, eventId))))
    .returning({ id: tickets.id })
  const ticket = await getTicket(ticketId)
  if (!ticket) return { status: 'invalid', reason: 'Ce billet n’existe pas.' }
  if (ticket.eventId !== eventId) return { status: 'invalid', reason: 'Ce billet est pour un autre événement.' }
  if (updated.length === 1) return { status: 'checked_in', ticket }
  if (ticket.cancelled) return { status: 'cancelled', ticket }
  if (!ticket.paid && !ticket.checkedInAt) {
    const order = await getOrder(eventId, ticket.orderId)
    return {
      status: 'unpaid',
      ticket,
      remaining: order ? Math.max(order.amount - order.paid, 0) : 0,
      currency: order?.currency ?? 'EUR',
    }
  }
  return { status: 'already_checked_in', ticket }
}

export async function checkInRemaining(eventId: string, orderId: number, by: string): Promise<number> {
  const updated = await db
    .update(tickets)
    .set({ checkedInAt: nowIso(), checkedInBy: by })
    .where(
      and(eq(tickets.orderId, orderId), isNull(tickets.checkedInAt), exists(activeOrderOf(tickets.orderId, eventId))),
    )
    .returning({ id: tickets.id })
  return updated.length
}

export async function undoCheckIn(eventId: string, ticketId: string): Promise<boolean> {
  const updated = await db
    .update(tickets)
    .set({ checkedInAt: null, checkedInBy: null })
    .where(and(eq(tickets.id, ticketId), inArray(tickets.orderId, ordersOf(eventId))))
    .returning({ id: tickets.id })
  return updated.length === 1
}

export type ExportRow = OrderSummary & { ticketCodes: string[]; ticketTypes: string[] }

export async function exportOrders(eventId: string): Promise<ExportRow[]> {
  const rows = await db.query.orders.findMany({
    where: { eventId },
    orderBy: { id: 'asc' },
    with: {
      tickets: {
        columns: { code: true, checkedInAt: true },
        orderBy: { seq: 'asc' },
        with: { ticketType: { columns: { name: true } } },
      },
      payments: { columns: { amount: true } },
    },
  })
  return rows.map(({ tickets: orderTickets, payments: orderPayments, ...order }) => ({
    ...order,
    paid: orderPayments.reduce((sum, payment) => sum + payment.amount, 0),
    checkedIn: orderTickets.filter((t) => t.checkedInAt).length,
    ticketCodes: orderTickets.map((t) => t.code),
    ticketTypes: orderTickets.map((t) => t.ticketType?.name ?? ''),
  }))
}
