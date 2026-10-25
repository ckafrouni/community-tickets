export type { Role } from './permissions'

export type EmailStatus = 'not_sent' | 'sent' | 'failed'

export type EventRole = 'host' | 'door'

export type EventDetails = {
  id: string
  name: string
  startsAt: string
  venue: string
  info: string
  ticketPrice: number
  currency: string
  contactEmail: string
}

export type EventListItem = EventDetails & { role: EventRole; ticketsSold: number; checkedIn: number }

export type EventMember = {
  userId: string
  name: string
  email: string
  role: EventRole
  createdAt: string
}

export type TicketSummary = {
  id: string
  eventId: string
  code: string
  seq: number
  orderId: number
  quantity: number
  buyerName: string
  checkedInAt: string | null
  checkedInBy: string | null
  cancelled: boolean
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
