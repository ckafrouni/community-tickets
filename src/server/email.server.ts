import { env } from 'cloudflare:workers'
import type { EmailStatus } from '#/lib/types'
import { bytesToBase64 } from './crypto.server'
import { renderTicketEmail, ticketEmailSubject, type EmailTicket } from './email-template.server'
import { qrPng } from './qr.server'
import { getOrder, getOrderTickets, getSettings, setEmailStatus } from './repo.server'
import { ticketUrl } from './tickets.server'

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

export async function sendTicketEmail(
  orderId: number,
  baseUrl: string,
): Promise<{ status: EmailStatus; error?: string }> {
  const order = await getOrder(orderId)
  if (!order) throw new Error('Order not found')
  if (order.cancelledAt) throw new Error('This order is cancelled')
  if (!order.buyerEmail) {
    await setEmailStatus(orderId, 'not_sent', 'No email address')
    return { status: 'not_sent', error: 'No email address' }
  }

  const [settings, orderTickets] = await Promise.all([getSettings(), getOrderTickets(orderId)])
  const tickets: (EmailTicket & { png: Uint8Array })[] = await Promise.all(
    orderTickets.map(async (t) => {
      const url = await ticketUrl(baseUrl, t.id)
      return { seq: t.seq, code: t.code, url, cid: `ticket-${t.code}`, png: await qrPng(url) }
    }),
  )
  const { html, text } = renderTicketEmail(settings, order, tickets)

  try {
    await env.EMAIL.send({
      from: { email: env.EMAIL_FROM, name: settings.eventName },
      to: { email: order.buyerEmail, name: order.buyerName },
      replyTo: settings.contactEmail || undefined,
      subject: ticketEmailSubject(settings, order),
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

export async function sendTestEmail(to: string): Promise<void> {
  const settings = await getSettings()
  await env.EMAIL.send({
    from: { email: env.EMAIL_FROM, name: settings.eventName },
    to,
    subject: `Test email from ${settings.eventName} tickets`,
    text: 'Email delivery is working. Buyers will receive their tickets from this address.',
  })
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

export async function sendPasswordLinkEmail({ to, name, url }: { to: string; name: string; url: string }) {
  const { eventName } = await getSettings()
  const greeting = name ? `Hi ${name.split(/\s+/)[0]},` : 'Hi,'
  try {
    await env.EMAIL.send({
      from: { email: env.EMAIL_FROM, name: eventName },
      to: { email: to, name },
      subject: `Set your password for ${eventName} tickets`,
      text: [
        greeting,
        '',
        `Use this link to set your password for the ${eventName} ticketing app:`,
        url,
        '',
        "The link expires in 24 hours. If you didn't expect this email, you can ignore it.",
      ].join('\n'),
      html: `<p>${escapeHtml(greeting)}</p>
<p>Use this link to set your password for the ${escapeHtml(eventName)} ticketing app:</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Set your password</a></p>
<p style="color:#64748b;font-size:13px">The link expires in 24 hours. If you didn't expect this email, you can ignore it.</p>`,
    })
  } catch (error) {
    console.error(`Failed to send password link to ${to}:`, describeError(error))
  }
}
