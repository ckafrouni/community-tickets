import { env } from 'cloudflare:workers'
import { signTicket, verifyTicketToken } from './crypto.server'

export function ticketToken(ticketId: string): Promise<string> {
  return signTicket(env.TICKET_SECRET, ticketId)
}

export async function ticketUrl(baseUrl: string, ticketId: string): Promise<string> {
  return `${baseUrl}/t/${await ticketToken(ticketId)}`
}

export function verifyTicket(token: string): Promise<string | null> {
  return verifyTicketToken(env.TICKET_SECRET, token)
}
