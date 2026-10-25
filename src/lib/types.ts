// Shared types used by both server functions and UI components.

export type { Role } from './permissions'

export type EmailStatus = 'not_sent' | 'sent' | 'failed'

export type TicketSummary = {
  id: string
  code: string
  seq: number
  orderId: number
  quantity: number
  buyerName: string
  checkedInAt: string | null
  checkedInBy: string | null
  cancelled: boolean
  /** How many tickets from the same order are already checked in. */
  orderCheckedIn: number
}

export type CheckInResult =
  | { status: 'checked_in'; ticket: TicketSummary }
  | { status: 'already_checked_in'; ticket: TicketSummary }
  | { status: 'cancelled'; ticket: TicketSummary }
  | { status: 'invalid'; reason: string }

export type OrderSummary = {
  id: number
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  quantity: number
  amount: number
  currency: string
  notes: string
  createdAt: string
  cancelledAt: string | null
  cancelReason: string
  emailStatus: EmailStatus
  emailUpdatedAt: string | null
  emailError: string
  checkedIn: number
}

export type OrderTicket = TicketSummary & { url: string; qrSvg: string }

export type OrderDetail = OrderSummary & { tickets: OrderTicket[] }

export type SalesStats = {
  orders: number
  ticketsSold: number
  revenue: number
  checkedIn: number
}
