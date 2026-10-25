import { env } from 'cloudflare:workers'
import { paymentReference, paymentStatus } from '#/lib/payments'
import type { EmailStatus, EventDetails, EventRole } from '#/lib/types'
import { bytesToBase64 } from './crypto.server'
import {
  APP_NAME,
  paymentRequestSubject,
  renderActionEmail,
  renderPaymentRequestEmail,
  renderTicketEmail,
  ticketEmailSubject,
  type EmailTicket,
} from './email-template.server'
import { qrPng } from './qr.server'
import {
  getEvent,
  getMemberRole,
  getOrder,
  getOrderTickets,
  listPayments,
  markTicketsSent,
  setEmailStatus,
} from './repo.server'
import { ticketUrl } from './tickets.server'

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
  return first ? `Bonjour ${first},` : 'Bonjour,'
}

export function roleLabel(role: EventRole) {
  return role === 'organizer' ? 'organisateur' : 'bénévole'
}

type EmailResult = { status: EmailStatus; kind: 'tickets' | 'payment_request'; error?: string }

async function loadOrder(eventId: string, orderId: number) {
  const [event, order] = await Promise.all([getEvent(eventId), getOrder(eventId, orderId)])
  if (!event || !order) throw new Error('Commande introuvable')
  if (order.cancelledAt) throw new Error('Cette commande est annulée')
  return { event, order }
}

async function deliver(
  orderId: number,
  kind: EmailResult['kind'],
  message: Parameters<typeof env.EMAIL.send>[0],
): Promise<EmailResult> {
  try {
    await env.EMAIL.send(message)
    await setEmailStatus(orderId, 'sent')
    if (kind === 'tickets') await markTicketsSent(orderId)
    return { status: 'sent', kind }
  } catch (error) {
    const text = describeError(error)
    console.error(`Failed to email order #${orderId}:`, text)
    await setEmailStatus(orderId, 'failed', text)
    return { status: 'failed', kind, error: text }
  }
}

export async function sendTicketEmail(eventId: string, orderId: number, baseUrl: string): Promise<EmailResult> {
  const { event, order } = await loadOrder(eventId, orderId)
  if (paymentStatus(order) !== 'paid') throw new Error('Le paiement n’est pas complet')
  const [orderTickets, orderPayments] = await Promise.all([getOrderTickets(orderId), listPayments(orderId)])
  const tickets: (EmailTicket & { png: Uint8Array })[] = await Promise.all(
    orderTickets.map(async (t) => {
      const url = await ticketUrl(baseUrl, t.id)
      return { seq: t.seq, code: t.code, typeName: t.typeName, url, cid: `ticket-${t.code}`, png: await qrPng(url) }
    }),
  )
  const { html, text } = renderTicketEmail(event, order, tickets, orderPayments)
  return deliver(orderId, 'tickets', {
    from: { email: env.EMAIL_FROM, name: APP_NAME },
    to: { email: order.buyerEmail, name: order.buyerName },
    replyTo: event.contactEmail || undefined,
    subject: ticketEmailSubject(event, order),
    html,
    text,
    attachments: tickets.map((t) => ({
      content: bytesToBase64(t.png),
      filename: `billet-${t.seq}-${t.code}.png`,
      type: 'image/png',
      disposition: 'inline' as const,
      contentId: t.cid,
    })),
  })
}

export async function sendPaymentRequestEmail(eventId: string, orderId: number): Promise<EmailResult> {
  const { event, order } = await loadOrder(eventId, orderId)
  const orderTickets = await getOrderTickets(orderId)
  const { html, text } = renderPaymentRequestEmail(
    event,
    order,
    orderTickets.map((t) => t.typeName),
    paymentReference(order.id),
  )
  return deliver(orderId, 'payment_request', {
    from: { email: env.EMAIL_FROM, name: APP_NAME },
    to: { email: order.buyerEmail, name: order.buyerName },
    replyTo: event.contactEmail || undefined,
    subject: paymentRequestSubject(event),
    html,
    text,
  })
}

export async function sendOrderEmail(eventId: string, orderId: number, baseUrl: string): Promise<EmailResult> {
  const order = await getOrder(eventId, orderId)
  if (!order) throw new Error('Commande introuvable')
  return paymentStatus(order) === 'paid'
    ? sendTicketEmail(eventId, orderId, baseUrl)
    : sendPaymentRequestEmail(eventId, orderId)
}

export async function sendTestEmail(event: EventDetails, to: string): Promise<void> {
  await env.EMAIL.send({
    from: { email: env.EMAIL_FROM, name: APP_NAME },
    to,
    replyTo: event.contactEmail || undefined,
    subject: `E-mail de test pour ${event.name}`,
    text: `L’envoi d’e-mails fonctionne. Les acheteurs de ${event.name} recevront leurs billets depuis cette adresse.\n\n—\nEnvoyé par ${APP_NAME}`,
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
    `Confirmez votre e-mail pour ${APP_NAME}`,
    renderActionEmail({
      title: 'Confirmez votre e-mail',
      greeting: greet(user.name),
      lines: [
        `Confirmez que ${user.email} est bien votre adresse pour terminer la création de votre compte ${APP_NAME}.`,
      ],
      action: { label: 'Confirmer mon e-mail', url },
      note: 'Le lien expire dans 24 heures. Si vous n’avez pas créé de compte, ignorez cet e-mail.',
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
      `Invitation : rejoignez l’équipe de ${event.name}`,
      renderActionEmail({
        title: `Rejoignez l’équipe de ${event.name}`,
        greeting: greet(user.name),
        lines: [
          `Vous rejoignez l’équipe de ${event.name} en tant que ${roleLabel(role)} sur ${APP_NAME}.`,
          `Choisissez un mot de passe pour vous connecter avec ${user.email}. L’application fonctionne sur votre téléphone pendant l’événement.`,
        ],
        action: { label: 'Choisir un mot de passe', url },
        note: 'Le lien expire dans 24 heures. Si vous ne vous attendiez pas à cet e-mail, ignorez-le.',
      }),
    )
  }

  return sendAppEmail(
    user,
    `Réinitialisez votre mot de passe ${APP_NAME}`,
    renderActionEmail({
      title: 'Réinitialisez votre mot de passe',
      greeting: greet(user.name),
      lines: [`Utilisez le bouton ci-dessous pour choisir un nouveau mot de passe pour ${user.email}.`],
      action: { label: 'Choisir un nouveau mot de passe', url },
      note: 'Le lien expire dans 24 heures. Si vous n’avez rien demandé, ignorez cet e-mail.',
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
    `Vous rejoignez l’équipe de ${event.name}`,
    renderActionEmail({
      title: `Vous faites partie de l’équipe de ${event.name}`,
      greeting: greet(to.name),
      lines: [
        `Vous rejoignez l’équipe de ${event.name} en tant que ${roleLabel(role)}. L’événement apparaît maintenant dans vos événements.`,
      ],
      action: { label: 'Ouvrir l’événement', url },
      note: `Vous recevez cet e-mail car quelqu’un a ajouté ${to.email} à un événement sur ${APP_NAME}.`,
    }),
  )
}
