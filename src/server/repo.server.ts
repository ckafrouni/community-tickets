import { and, asc, count, desc, eq, exists, getColumns, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm'
import { alias, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { DEFAULT_SETTINGS, eventSettingsSchema, type EventSettings, type SaleInput } from '#/lib/schemas'
import type { CheckInResult, EmailStatus, OrderSummary, SalesStats, TicketSummary } from '#/lib/types'
import { randomCode, randomTicketId } from './crypto.server'
import { db } from './db/client.server'
import { orders, settings, tickets } from './db/schema'

const nowIso = () => new Date().toISOString()

/** Case-insensitive substring match with LIKE wildcards in the input escaped. */
function contains(column: AnySQLiteColumn, query: string): SQL {
  const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`
}

function orderNumber(q: string) {
  return /^#?\d+$/.test(q) ? Number(q.replace('#', '')) : -1
}

const isActiveOrder = isNull(orders.cancelledAt)

// ---------------------------------------------------------------- settings

export async function getSettings(): Promise<EventSettings> {
  const row = await db.query.settings.findFirst({ where: { key: 'event' } })
  if (!row) return DEFAULT_SETTINGS
  const parsed = eventSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...JSON.parse(row.value) })
  return parsed.success ? parsed.data : DEFAULT_SETTINGS
}

export async function saveSettings(value: EventSettings) {
  const row = { key: 'event', value: JSON.stringify(value) }
  await db
    .insert(settings)
    .values(row)
    .onConflictDoUpdate({ target: settings.key, set: { value: row.value } })
}

// ---------------------------------------------------------------- orders

const orderFields = {
  ...getColumns(orders),
  checkedIn: db.$count(tickets, and(eq(tickets.orderId, orders.id), isNotNull(tickets.checkedInAt))),
}

/** Creates the order and all of its tickets in one atomic D1 batch. */
export async function createOrder(input: SaleInput, currency: string): Promise<number> {
  const createdAt = nowIso()
  for (let attempt = 0; ; attempt++) {
    const insertOrder = db
      .insert(orders)
      .values({
        buyerName: input.buyerName,
        buyerEmail: input.buyerEmail,
        buyerPhone: input.buyerPhone,
        quantity: input.quantity,
        amount: input.amount,
        currency,
        notes: input.notes,
        createdAt,
      })
      .returning({ id: orders.id })
    // A batch runs as one transaction on the database's single writer, and
    // AUTOINCREMENT ids only grow, so MAX(id) is the order inserted just above.
    const insertTickets = db.insert(tickets).values(
      Array.from({ length: input.quantity }, (_, i) => ({
        id: randomTicketId(),
        code: randomCode(),
        orderId: sql`(SELECT MAX(${orders.id}) FROM ${orders})`,
        seq: i + 1,
        createdAt,
      })),
    )
    try {
      const [[order]] = await db.batch([insertOrder, insertTickets])
      return order.id
    } catch (error) {
      // Ticket codes are 40 random bits; retry on the (astronomically unlikely) collision.
      if (attempt >= 3 || !isUniqueViolation(error)) throw error
    }
  }
}

/** D1 reports constraint failures on the error Drizzle wraps as `cause`. */
function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const cause = error.cause instanceof Error ? error.cause.message : ''
  return /UNIQUE/.test(`${error.message} ${cause}`)
}

export async function getOrder(id: number): Promise<OrderSummary | null> {
  const [order] = await db.select(orderFields).from(orders).where(eq(orders.id, id))
  return order ?? null
}

export async function listOrders(q: string): Promise<OrderSummary[]> {
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
  return db.select(orderFields).from(orders).where(filter).orderBy(desc(orders.id))
}

export async function updateOrderBuyer(
  id: number,
  buyer: { buyerName: string; buyerEmail: string; buyerPhone: string; notes: string },
) {
  await db.update(orders).set(buyer).where(eq(orders.id, id))
}

export async function setOrderCancelled(id: number, cancelled: boolean, reason = '') {
  await db
    .update(orders)
    .set({ cancelledAt: cancelled ? nowIso() : null, cancelReason: cancelled ? reason : '' })
    .where(eq(orders.id, id))
}

export async function setEmailStatus(id: number, status: EmailStatus, error = '') {
  await db
    .update(orders)
    .set({ emailStatus: status, emailError: error.slice(0, 500), emailUpdatedAt: nowIso() })
    .where(eq(orders.id, id))
}

export async function getStats(): Promise<SalesStats> {
  const [[totals], checkedIn] = await Promise.all([
    db
      .select({
        orders: count(),
        ticketsSold: sql<number>`coalesce(sum(${orders.quantity}), 0)`.mapWith(Number),
        revenue: sql<number>`coalesce(sum(${orders.amount}), 0)`.mapWith(Number),
      })
      .from(orders)
      .where(isActiveOrder),
    db.$count(tickets, and(isNotNull(tickets.checkedInAt), exists(activeOrderOf(tickets.orderId)))),
  ])
  return { ...totals, checkedIn }
}

// ---------------------------------------------------------------- tickets

const sibling = alias(tickets, 'sibling')

const ticketFields = {
  id: tickets.id,
  code: tickets.code,
  seq: tickets.seq,
  orderId: tickets.orderId,
  quantity: orders.quantity,
  buyerName: orders.buyerName,
  checkedInAt: tickets.checkedInAt,
  checkedInBy: tickets.checkedInBy,
  cancelled: sql<boolean>`${orders.cancelledAt} IS NOT NULL`.mapWith(Boolean),
  // Scalar subquery: tickets on the same order that are already checked in.
  orderCheckedIn: sql<number>`(${db
    .select({ n: count() })
    .from(sibling)
    .where(and(eq(sibling.orderId, tickets.orderId), isNotNull(sibling.checkedInAt)))})`.mapWith(Number),
}

function selectTickets(where: SQL | undefined) {
  return db.select(ticketFields).from(tickets).innerJoin(orders, eq(orders.id, tickets.orderId)).where(where)
}

/** Subquery: the given order exists and is not cancelled. */
function activeOrderOf(orderId: AnySQLiteColumn) {
  return db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.id, orderId), isActiveOrder))
}

export async function getTicket(id: string): Promise<TicketSummary | null> {
  const [ticket] = await selectTickets(eq(tickets.id, id))
  return ticket ?? null
}

export function getOrderTickets(orderId: number): Promise<TicketSummary[]> {
  return selectTickets(eq(tickets.orderId, orderId)).orderBy(asc(tickets.seq))
}

export function searchTickets(q: string, code: string): Promise<TicketSummary[]> {
  const query = q.trim()
  return selectTickets(
    or(
      contains(orders.buyerName, query),
      contains(orders.buyerEmail, query),
      contains(orders.buyerPhone, query),
      eq(tickets.code, code),
      eq(orders.id, orderNumber(query)),
    ),
  )
    .orderBy(sql`${orders.buyerName} COLLATE NOCASE`, asc(orders.id), asc(tickets.seq))
    .limit(40)
}

export function recentCheckIns(limit = 8): Promise<TicketSummary[]> {
  return selectTickets(isNotNull(tickets.checkedInAt)).orderBy(desc(tickets.checkedInAt)).limit(limit)
}

/**
 * Checks a ticket in exactly once. The conditional UPDATE is atomic, so two
 * door phones scanning the same code at the same moment can't both admit it.
 */
export async function checkInTicket(ticketId: string, by: string): Promise<CheckInResult> {
  const updated = await db
    .update(tickets)
    .set({ checkedInAt: nowIso(), checkedInBy: by })
    .where(and(eq(tickets.id, ticketId), isNull(tickets.checkedInAt), exists(activeOrderOf(tickets.orderId))))
    .returning({ id: tickets.id })
  const ticket = await getTicket(ticketId)
  if (!ticket) return { status: 'invalid', reason: 'This ticket does not exist.' }
  if (updated.length === 1) return { status: 'checked_in', ticket }
  if (ticket.cancelled) return { status: 'cancelled', ticket }
  return { status: 'already_checked_in', ticket }
}

/** Check in every remaining ticket on an order (e.g. a family arriving together). */
export async function checkInRemaining(orderId: number, by: string): Promise<number> {
  const updated = await db
    .update(tickets)
    .set({ checkedInAt: nowIso(), checkedInBy: by })
    .where(and(eq(tickets.orderId, orderId), isNull(tickets.checkedInAt), exists(activeOrderOf(tickets.orderId))))
    .returning({ id: tickets.id })
  return updated.length
}

export async function undoCheckIn(ticketId: string) {
  await db.update(tickets).set({ checkedInAt: null, checkedInBy: null }).where(eq(tickets.id, ticketId))
}

export type ExportRow = OrderSummary & { ticketCodes: string[] }

export async function exportOrders(): Promise<ExportRow[]> {
  const rows = await db.query.orders.findMany({
    orderBy: { id: 'asc' },
    with: { tickets: { columns: { code: true, checkedInAt: true }, orderBy: { seq: 'asc' } } },
  })
  return rows.map(({ tickets: orderTickets, ...order }) => ({
    ...order,
    checkedIn: orderTickets.filter((t) => t.checkedInAt).length,
    ticketCodes: orderTickets.map((t) => t.code),
  }))
}
