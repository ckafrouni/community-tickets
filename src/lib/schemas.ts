import { z } from 'zod'
import { isValidCurrency, parseEventDate } from './format'

const isEmail = (v: string) => z.email().safeParse(v).success

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .refine((v) => v === '' || isEmail(v), 'Saisissez une adresse e-mail valide')

const requiredEmail = z.string().trim().toLowerCase().max(200).refine(isEmail, 'Saisissez une adresse e-mail valide')

export const eventSchema = z.object({
  name: z.string().trim().min(1, 'Le nom de l’événement est obligatoire').max(120),
  startsAt: z
    .string()
    .trim()
    .refine((v) => v === '' || parseEventDate(v) !== null, 'Choisissez une date et une heure'),
  venue: z.string().trim().max(200),
  info: z.string().trim().max(2000),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isValidCurrency, 'Utilisez un code devise à 3 lettres, par exemple EUR'),
  contactEmail: optionalEmail,
  bankDetails: z.string().trim().max(1000),
})

export type EventInput = z.infer<typeof eventSchema>

export const NEW_EVENT: EventInput = {
  name: '',
  startsAt: '',
  venue: '',
  info: '',
  currency: 'EUR',
  contactEmail: '',
  bankDetails: '',
}

const money = z.number().int().min(0).max(100_000_000)

export const ticketTypeSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, 'Donnez un nom à chaque tarif').max(60),
  price: money,
})

export type TicketTypeInput = z.infer<typeof ticketTypeSchema>

export const ticketTypesSchema = z.array(ticketTypeSchema).min(1, 'Ajoutez au moins un tarif').max(20)

export const NEW_TICKET_TYPES: TicketTypeInput[] = [{ name: 'Plein tarif', price: 1000 }]

export const createEventSchema = eventSchema.extend({ ticketTypes: ticketTypesSchema })

export const eventIdSchema = z.object({ eventId: z.string().min(1).max(32) })

export const buyerSchema = z.object({
  buyerName: z.string().trim().min(1, 'Le nom est obligatoire').max(120),
  buyerEmail: requiredEmail,
  buyerPhone: z.string().trim().max(40),
  notes: z.string().trim().max(1000),
})

export const paymentMethodSchema = z.enum(['cash', 'transfer'])

export const saleSchema = buyerSchema.extend({
  items: z
    .array(z.object({ ticketTypeId: z.number().int().positive(), quantity: z.number().int().min(0).max(50) }))
    .min(1)
    .max(20)
    .refine((items) => {
      const total = items.reduce((sum, item) => sum + item.quantity, 0)
      return total >= 1 && total <= 50
    }, 'Choisissez entre 1 et 50 billets'),
  received: money,
  method: paymentMethodSchema,
})

export const paymentSchema = z.object({
  amount: money.min(1, 'Saisissez un montant'),
  method: paymentMethodSchema,
  note: z.string().trim().max(200),
})

export type SaleInput = z.infer<typeof saleSchema>

export const memberSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire').max(120),
  email: z.email('Saisissez une adresse e-mail valide').trim().toLowerCase(),
  role: z.enum(['organizer', 'volunteer']),
})

export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  try {
    const parsed = JSON.parse(message)
    if (Array.isArray(parsed) && parsed[0]?.message) return parsed[0].message
  } catch {}
  return message || 'Une erreur est survenue'
}
