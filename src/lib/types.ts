export type { Role } from './permissions'

export type EmailStatus = 'not_sent' | 'sent' | 'failed'

export type EventRole = 'organizer' | 'volunteer'

export type PaymentMethod = 'cash' | 'transfer'

export type PaymentStatus = 'paid' | 'partial' | 'unpaid'

export type TicketType = { id: number; name: string; price: number; sold: number }

export type Payment = {
  id: number
  amount: number
  method: PaymentMethod
  note: string
  receivedAt: string
  recordedBy: string
}

export type EventDetails = {
  id: string
  name: string
  startsAt: string
  venue: string
  info: string
  currency: string
  contactEmail: string
  bankDetails: string
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
  typeName: string
  checkedInAt: string | null
  checkedInBy: string | null
  cancelled: boolean
  paid: boolean
  orderCheckedIn: number
}

export type CheckInResult =
  | { status: 'checked_in'; ticket: TicketSummary }
  | { status: 'already_checked_in'; ticket: TicketSummary }
  | { status: 'cancelled'; ticket: TicketSummary }
  | { status: 'unpaid'; ticket: TicketSummary; remaining: number; currency: string }
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
  ticketsSentAt: string | null
  paid: number
  checkedIn: number
}

export type OrderTicket = TicketSummary & { url: string; qrSvg: string }

export type OrderDetail = OrderSummary & { tickets: OrderTicket[]; payments: Payment[]; reference: string }

export type SalesStats = {
  orders: number
  ticketsSold: number
  revenue: number
  outstanding: number
  checkedIn: number
}
