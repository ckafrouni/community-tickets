import { sql } from 'drizzle-orm'
import { check, index, integer, snakeCase, text, unique } from 'drizzle-orm/sqlite-core'
import type { EmailStatus } from '#/lib/types'

export * from './auth-schema'

// App timestamps are ISO-8601 strings: sortable, and readable in the D1 console.
// (Better Auth stores its own timestamps as milliseconds.)

/** Event settings, edited on the Settings page (stored as one JSON row). */
export const settings = snakeCase.table('settings', {
  key: text().primaryKey(),
  value: text().notNull(),
})

export const orders = snakeCase.table(
  'orders',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    buyerName: text().notNull(),
    buyerEmail: text().notNull().default(''),
    buyerPhone: text().notNull().default(''),
    quantity: integer().notNull(),
    /** Cash received, in minor units (cents). */
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
    check('orders_quantity_positive', sql`${t.quantity} > 0`),
    check('orders_amount_not_negative', sql`${t.amount} >= 0`),
  ],
)

/**
 * One row per admitted person. `id` is the random value signed into the QR
 * code; `code` is the short human-readable code printed under it.
 */
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
    /** Name of the staff member who scanned the ticket. */
    checkedInBy: text(),
  },
  (t) => [unique().on(t.orderId, t.seq), index('tickets_checked_in_at_idx').on(t.checkedInAt)],
)
