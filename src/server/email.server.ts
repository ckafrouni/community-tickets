import { env } from 'cloudflare:workers'
import type { EmailStatus, EventDetails, EventRole } from '#/lib/types'
import { bytesToBase64 } from './crypto.server'
import { renderActionEmail, renderTicketEmail, ticketEmailSubject, type EmailTicket } from './email-template.server'
import { qrPng } from './qr.server'
import { getEvent, getMemberRole, getOrder, getOrderTickets, setEmailStatus } from './repo.server'
import { ticketUrl } from './tickets.server'

const APP_NAME = 'Community Tickets'

export const INVITE_PARAM = 'invite'

export function getEmailFrom(): string {
  return env.EMAIL_FROM
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code
    return code ? `${code}: ${error.message}` : error.message
  }
  return String(error)
}

function greet(name: string) {
  const first = name.trim().split(/\s+/)[0]
  return first ? `Hi ${first},` : 'Hi,'
}

export function roleLabel(role: EventRole) {
  return role === 'host' ? 'a host' : 'door staff'
}

export async function sendTicketEmail(
  eventId: string,
  orderId: number,
  baseUrl: string,
): Promise<{ status: EmailStatus; error?: string }> {
  const [event, order] = await Promise.all([getEvent(eventId), getOrder(eventId, orderId)])
  if (!event || !order) throw new Error('Order not found')
  if (order.cancelledAt) throw new Error('This order is cancelled')
  if (!order.buyerEmail) {
    await setEmailStatus(orderId, 'not_sent', 'No email address')
    return { status: 'not_sent', error: 'No email address' }
  }

  const tickets: (EmailTicket & { png: Uint8Array })[] = await Promise.all(
    (await getOrderTickets(orderId)).map(async (t) => {
      const url = await ticketUrl(baseUrl, t.id)
      return { seq: t.seq, code: t.code, url, cid: `ticket-${t.code}`, png: await qrPng(url) }
    }),
  )
  const { html, text } = renderTicketEmail(event, order, tickets)

  try {
    await env.EMAIL.send({
      from: { email: env.EMAIL_FROM, name: event.name },
      to: { email: order.buyerEmail, name: order.buyerName },
      replyTo: event.contactEmail || undefined,
      subject: ticketEmailSubject(event, order),
      html,
      text,
      attachments: tickets.map((t) => ({
        content: bytesToBase64(t.png),
        filename: `ticket-${t.seq}-${t.code}.png`,
        type: 'image/png',
        disposition: 'inline' as const,
        contentId: t.cid,
      })),
    })
    await setEmailStatus(orderId, 'sent')
    return { status: 'sent' }
  } catch (error) {
    const message = describeError(error)
    console.error(`Failed to email order #${orderId}:`, message)
    await setEmailStatus(orderId, 'failed', message)
    return { status: 'failed', error: message }
  }
}

export async function sendTestEmail(event: EventDetails, to: string): Promise<void> {
  await env.EMAIL.send({
    from: { email: env.EMAIL_FROM, name: event.name },
    to,
    replyTo: event.contactEmail || undefined,
    subject: `Test email for ${event.name}`,
    text: `Email delivery works. Buyers of ${event.name} will receive their tickets from this address.`,
  })
}

async function sendAppEmail(
  to: { email: string; name: string },
  subject: string,
  content: { html: string; text: string },
) {
  try {
    await env.EMAIL.send({ from: { email: env.EMAIL_FROM, name: APP_NAME }, to, subject, ...content })
  } catch (error) {
    console.error(`Failed to send "${subject}" to ${to.email}:`, describeError(error))
  }
}

type AuthEmail = { user: { id: string; email: string; name: string }; url: string }

export function sendVerificationEmail({ user, url }: AuthEmail) {
  return sendAppEmail(
    user,
    `Confirm your email for ${APP_NAME}`,
    renderActionEmail({
      title: 'Confirm your email',
      greeting: greet(user.name),
      lines: [`Confirm that ${user.email} is your email address to finish creating your ${APP_NAME} account.`],
      action: { label: 'Confirm email', url },
      note: "The link expires in 24 hours. If you didn't create an account, you can ignore this email.",
    }),
  )
}

function inviteEventId(url: string): string | null {
  try {
    const callback = new URL(url).searchParams.get('callbackURL')
    return callback ? new URL(callback, env.APP_URL).searchParams.get(INVITE_PARAM) : null
  } catch {
    return null
  }
}

export async function sendPasswordEmail({ user, url }: AuthEmail) {
  const eventId = inviteEventId(url)
  const [event, role] = eventId ? await Promise.all([getEvent(eventId), getMemberRole(eventId, user.id)]) : [null, null]

  if (event && role) {
    return sendAppEmail(
      user,
      `You're invited to help run ${event.name}`,
      renderActionEmail({
        title: `Join the team for ${event.name}`,
        greeting: greet(user.name),
        lines: [
          `You've been added as ${roleLabel(role)} for ${event.name} on ${APP_NAME}.`,
          `Choose a password to sign in as ${user.email}. The app works on your phone at the event.`,
        ],
        action: { label: 'Choose a password', url },
        note: "The link expires in 24 hours. If you weren't expecting this, you can ignore this email.",
      }),
    )
  }

  return sendAppEmail(
    user,
    `Reset your ${APP_NAME} password`,
    renderActionEmail({
      title: 'Reset your password',
      greeting: greet(user.name),
      lines: [`Use the button below to choose a new password for ${user.email}.`],
      action: { label: 'Choose a new password', url },
      note: "The link expires in 24 hours. If you didn't ask for this, you can ignore this email.",
    }),
  )
}

export function sendAddedToEventEmail({
  to,
  event,
  role,
  url,
}: {
  to: { email: string; name: string }
  event: EventDetails
  role: EventRole
  url: string
}) {
  return sendAppEmail(
    to,
    `You've been added to ${event.name}`,
    renderActionEmail({
      title: `You're on the team for ${event.name}`,
      greeting: greet(to.name),
      lines: [`You've been added as ${roleLabel(role)} for ${event.name}. It now shows up in your events.`],
      action: { label: 'Open event', url },
      note: `You received this because someone added ${to.email} to an event on ${APP_NAME}.`,
    }),
  )
}
