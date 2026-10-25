import { env } from 'cloudflare:workers'
import { signTicket, verifyTicketToken } from './crypto.server'

/** Ticket id → signed token, using the TICKET_SECRET Worker secret. */
export function ticketToken(ticketId: string): Promise<string> {
  return signTicket(env.TICKET_SECRET, ticketId)
}

/** The URL encoded in each QR code; opening it shows the ticket page. */
export async function ticketUrl(baseUrl: string, ticketId: string): Promise<string> {
  return `${baseUrl}/t/${await ticketToken(ticketId)}`
}

/** Signed token → ticket id, or null if the signature is not genuine. */
export function verifyTicket(token: string): Promise<string | null> {
  return verifyTicketToken(env.TICKET_SECRET, token)
}
