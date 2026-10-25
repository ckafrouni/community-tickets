import { sql } from 'drizzle-orm'
import { check, index, integer, snakeCase, text, unique } from 'drizzle-orm/sqlite-core'
import type { EmailStatus } from '#/lib/types'

export * from './auth-schema'

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
