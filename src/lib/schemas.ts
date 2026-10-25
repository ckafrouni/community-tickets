import { z } from 'zod'
import { isValidCurrency, parseEventDate } from './format'

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email address')

export const eventSchema = z.object({
  name: z.string().trim().min(1, 'Event name is required').max(120),
  startsAt: z
    .string()
    .trim()
    .refine((v) => v === '' || parseEventDate(v) !== null, 'Pick a date and time'),
  venue: z.string().trim().max(200),
  info: z.string().trim().max(2000),
  ticketPrice: z.number().int().min(0).max(100_000_000),
  currency: z.string().trim().toUpperCase().refine(isValidCurrency, 'Use a 3-letter currency code like USD or EUR'),
  contactEmail: optionalEmail,
})

export type EventInput = z.infer<typeof eventSchema>

export const NEW_EVENT: EventInput = {
  name: '',
  startsAt: '',
  venue: '',
  info: '',
  ticketPrice: 1000,
  currency: 'USD',
  contactEmail: '',
}

export const eventIdSchema = z.object({ eventId: z.string().min(1).max(32) })

export const buyerSchema = z.object({
  buyerName: z.string().trim().min(1, 'Name is required').max(120),
  buyerEmail: optionalEmail,
  buyerPhone: z.string().trim().max(40),
  notes: z.string().trim().max(1000),
})

export const saleSchema = buyerSchema.extend({
  quantity: z.number().int().min(1, 'At least 1 ticket').max(50, 'At most 50 tickets per sale'),
  amount: z.number().int().min(0).max(100_000_000),
  sendEmail: z.boolean(),
})

export type SaleInput = z.infer<typeof saleSchema>

export const memberSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  role: z.enum(['host', 'door']),
})

export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  try {
    const parsed = JSON.parse(message)
    if (Array.isArray(parsed) && parsed[0]?.message) return parsed[0].message
  } catch {}
  return message || 'Something went wrong'
}
