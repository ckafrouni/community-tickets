import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, snakeCase, text, unique } from 'drizzle-orm/sqlite-core'
import type { EmailStatus, EventRole } from '#/lib/types'
import { user } from './auth-schema'

export * from './auth-schema'

export const events = snakeCase.table(
  'events',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    startsAt: text().notNull().default(''),
    venue: text().notNull().default(''),
    info: text().notNull().default(''),
    ticketPrice: integer().notNull(),
    currency: text().notNull(),
    contactEmail: text().notNull().default(''),
    createdBy: text()
      .notNull()
      .references(() => user.id),
    createdAt: text().notNull(),
  },
  (t) => [check('events_ticket_price_not_negative', sql`${t.ticketPrice} >= 0`)],
)

export const eventMembers = snakeCase.table(
  'event_members',
  {
    eventId: text()
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text().$type<EventRole>().notNull(),
    createdAt: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] }), index('event_members_user_id_idx').on(t.userId)],
)

export const orders = snakeCase.table(
  'orders',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    eventId: text()
      .notNull()
      .references(() => events.id),
    buyerName: text().notNull(),
    buyerEmail: text().notNull().default(''),
    buyerPhone: text().notNull().default(''),
    quantity: integer().notNull(),
    amount: integer().notNull(),
    currency: text().notNull(),
    notes: text().notNull().default(''),
    createdAt: text().notNull(),
    cancelledAt: text(),
    cancelReason: text().notNull().default(''),
    emailStatus: text().$type<EmailStatus>().notNull().default('not_sent'),
    emailUpdatedAt: text(),
    emailError: text().notNull().default(''),
  },
  (t) => [
    index('orders_event_id_idx').on(t.eventId),
    check('orders_quantity_positive', sql`${t.quantity} > 0`),
    check('orders_amount_not_negative', sql`${t.amount} >= 0`),
  ],
)

export const tickets = snakeCase.table(
  'tickets',
  {
    id: text().primaryKey(),
    code: text().notNull().unique(),
    orderId: integer()
      .notNull()
      .references(() => orders.id),
    seq: integer().notNull(),
    createdAt: text().notNull(),
    checkedInAt: text(),
    checkedInBy: text(),
  },
  (t) => [unique().on(t.orderId, t.seq), index('tickets_checked_in_at_idx').on(t.checkedInAt)],
)
