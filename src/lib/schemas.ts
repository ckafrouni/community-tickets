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
  ticketPrice: z.number().int().min(0).max(100_000_000),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isValidCurrency, 'Utilisez un code devise à 3 lettres, par exemple EUR'),
  contactEmail: optionalEmail,
})

export type EventInput = z.infer<typeof eventSchema>

export const NEW_EVENT: EventInput = {
  name: '',
  startsAt: '',
  venue: '',
  info: '',
  ticketPrice: 1000,
  currency: 'EUR',
  contactEmail: '',
}

export const eventIdSchema = z.object({ eventId: z.string().min(1).max(32) })

export const buyerSchema = z.object({
  buyerName: z.string().trim().min(1, 'Le nom est obligatoire').max(120),
  buyerEmail: requiredEmail,
  buyerPhone: z.string().trim().max(40),
  notes: z.string().trim().max(1000),
})

export const saleSchema = buyerSchema.extend({
  quantity: z.number().int().min(1, 'Au moins 1 billet').max(50, '50 billets maximum par vente'),
  amount: z.number().int().min(0).max(100_000_000),
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
