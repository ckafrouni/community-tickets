import { formatCode, formatMoney } from '#/lib/format'
import type { EventSettings } from '#/lib/schemas'
import type { OrderSummary } from '#/lib/types'

export type EmailTicket = { seq: number; code: string; url: string; cid: string }

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function paragraphs(text: string): string {
  return esc(text).replace(/\r?\n/g, '<br>')
}

export function ticketEmailSubject(settings: EventSettings, order: OrderSummary): string {
  return order.quantity === 1
    ? `Your ticket for ${settings.eventName}`
    : `Your ${order.quantity} tickets for ${settings.eventName}`
}

export function renderTicketEmail(
  settings: EventSettings,
  order: OrderSummary,
  tickets: EmailTicket[],
): { html: string; text: string } {
  const when = [settings.eventDate, settings.eventVenue].filter(Boolean)
  const paid = formatMoney(order.amount, order.currency)
  const paidOn = new Date(order.createdAt).toLocaleDateString('en', { dateStyle: 'long' })
  const firstName = order.buyerName.split(/\s+/)[0]
  const many = tickets.length > 1

  const ticketBlocks = tickets
    .map(
      (t) => `
      <tr><td style="padding:0 24px 24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px dashed #cbd5e1;border-radius:12px">
          <tr><td align="center" style="padding:20px 16px 8px;font:600 13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#475569;letter-spacing:.08em;text-transform:uppercase">
            Admit one${many ? ` &middot; Ticket ${t.seq} of ${tickets.length}` : ''}
          </td></tr>
          <tr><td align="center" style="padding:4px 16px">
            <img src="cid:${t.cid}" width="240" height="240" alt="Ticket QR code ${esc(formatCode(t.code))}" style="display:block;width:240px;height:240px;border:0">
          </td></tr>
          <tr><td align="center" style="padding:8px 16px 4px;font:700 20px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0f172a;letter-spacing:.12em">
            ${esc(formatCode(t.code))}
          </td></tr>
          <tr><td align="center" style="padding:4px 16px 20px;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
            <a href="${esc(t.url)}" style="color:#4f46e5">Open this ticket in your browser</a>
          </td></tr>
        </table>
      </td></tr>`,
    )
    .join('')

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ticketEmailSubject(settings, order))}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
  <tr><td style="background:#4f46e5;padding:28px 24px;color:#ffffff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
    <div style="font-size:24px;font-weight:700;line-height:1.3">${esc(settings.eventName)}</div>
    ${when.length ? `<div style="margin-top:6px;font-size:15px;opacity:.9">${when.map(esc).join(' &middot; ')}</div>` : ''}
  </td></tr>
  <tr><td style="padding:24px;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a">
    <p style="margin:0 0 12px">Hi ${esc(firstName)},</p>
    <p style="margin:0">Thanks for your payment! ${many ? `Here are your ${tickets.length} tickets` : 'Here is your ticket'}. Show the QR code${many ? 's' : ''} at the entrance. Each code can only be scanned once, so please don't share ${many ? 'them' : 'it'} publicly.</p>
  </td></tr>
  ${ticketBlocks}
  <tr><td style="padding:0 24px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;font:14px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#334155">
      <tr><td colspan="2" style="padding:16px 16px 4px;font-weight:700;color:#0f172a">Receipt</td></tr>
      <tr><td style="padding:2px 16px">Order</td><td align="right" style="padding:2px 16px">#${order.id}</td></tr>
      <tr><td style="padding:2px 16px">Name</td><td align="right" style="padding:2px 16px">${esc(order.buyerName)}</td></tr>
      <tr><td style="padding:2px 16px">Tickets</td><td align="right" style="padding:2px 16px">${order.quantity}</td></tr>
      <tr><td style="padding:2px 16px">Paid in cash</td><td align="right" style="padding:2px 16px;font-weight:700;color:#0f172a">${esc(paid)}</td></tr>
      <tr><td style="padding:2px 16px 16px">Date</td><td align="right" style="padding:2px 16px 16px">${esc(paidOn)}</td></tr>
    </table>
  </td></tr>
  ${settings.eventInfo ? `<tr><td style="padding:0 24px 24px;font:14px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#334155">${paragraphs(settings.eventInfo)}</td></tr>` : ''}
  ${settings.contactEmail ? `<tr><td style="padding:0 24px 28px;font:13px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#64748b">Questions? Reply to this email or write to <a href="mailto:${esc(settings.contactEmail)}" style="color:#4f46e5">${esc(settings.contactEmail)}</a>.</td></tr>` : ''}
</table>
</td></tr></table>
</body></html>`

  const text = [
    settings.eventName,
    ...when,
    '',
    `Hi ${firstName},`,
    '',
    `Thanks for your payment! ${many ? `Here are your ${tickets.length} tickets` : 'Here is your ticket'}. Show the QR code at the entrance; each code can only be scanned once.`,
    '',
    ...tickets.flatMap((t) => [
      `${many ? `Ticket ${t.seq} of ${tickets.length}` : 'Ticket'}: ${formatCode(t.code)}`,
      t.url,
      '',
    ]),
    'Receipt',
    `Order #${order.id} - ${order.buyerName}`,
    `${order.quantity} ticket(s), paid in cash: ${paid}`,
    `Date: ${paidOn}`,
    ...(settings.eventInfo ? ['', settings.eventInfo] : []),
    ...(settings.contactEmail ? ['', `Questions? Write to ${settings.contactEmail}`] : []),
  ].join('\n')

  return { html, text }
}
