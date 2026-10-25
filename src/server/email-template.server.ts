import { describeEventDate, formatCode, formatLongDate, formatMoney } from '#/lib/format'
import type { EventDetails, OrderSummary } from '#/lib/types'

export type EmailTicket = { seq: number; code: string; url: string; cid: string }

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const INK = '#18181b'
const MUTED = '#71717a'

export function esc(value: string): string {
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

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

function button(label: string, url: string): string {
  return `<a href="${esc(url)}" style="display:inline-block;background:${INK};color:#ffffff;padding:13px 22px;border-radius:10px;text-decoration:none;font:600 15px/1 ${FONT}">${esc(label)}</a>`
}

function layout({ title, preheader, body }: { title: string; preheader: string; body: string }): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;border:1px solid #e4e4e7">
${body}
</table>
<p style="margin:16px 0 0;font:12px/1.5 ${FONT};color:#a1a1aa">Envoyé par Community Tickets</p>
</td></tr></table>
</body></html>`
}

function linkFallback(url: string): string {
  return `<p style="margin:16px 0 0;font:13px/1.5 ${FONT};color:${MUTED}">Ou ouvrez ce lien :<br><a href="${esc(url)}" style="color:${MUTED};word-break:break-all">${esc(url)}</a></p>`
}

export function renderActionEmail({
  title,
  greeting,
  lines,
  action,
  note,
}: {
  title: string
  greeting: string
  lines: string[]
  action: { label: string; url: string }
  note: string
}): { html: string; text: string } {
  const html = layout({
    title,
    preheader: lines[0] ?? title,
    body: `<tr><td style="padding:32px 28px;font:16px/1.6 ${FONT};color:${INK}">
  <h1 style="margin:0 0 16px;font:700 24px/1.25 ${FONT};color:${INK}">${esc(title)}</h1>
  <p style="margin:0 0 12px">${esc(greeting)}</p>
  ${lines.map((line) => `<p style="margin:0 0 12px">${esc(line)}</p>`).join('')}
  <p style="margin:24px 0 0">${button(action.label, action.url)}</p>
  ${linkFallback(action.url)}
  <p style="margin:24px 0 0;font:13px/1.5 ${FONT};color:${MUTED}">${esc(note)}</p>
</td></tr>`,
  })
  const text = [title, '', greeting, '', ...lines, '', `${action.label}: ${action.url}`, '', note].join('\n')
  return { html, text }
}

export function ticketEmailSubject(event: EventDetails, order: OrderSummary): string {
  return order.quantity === 1 ? `Votre billet pour ${event.name}` : `Vos ${order.quantity} billets pour ${event.name}`
}

export function renderTicketEmail(
  event: EventDetails,
  order: OrderSummary,
  tickets: EmailTicket[],
): { html: string; text: string } {
  const when = [event.startsAt ? describeEventDate(event.startsAt) : '', event.venue].filter(Boolean)
  const paid = formatMoney(order.amount, order.currency)
  const paidOn = formatLongDate(order.createdAt)
  const name = firstName(order.buyerName)
  const many = tickets.length > 1
  const subject = ticketEmailSubject(event, order)

  const ticketBlocks = tickets
    .map(
      (t) => `
  <tr><td style="padding:0 28px 20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:16px">
      <tr><td align="center" style="padding:18px 16px 4px;font:600 12px/1.4 ${FONT};color:${MUTED};letter-spacing:.08em;text-transform:uppercase">
        Entrée${many ? ` &middot; ${t.seq} sur ${tickets.length}` : ''}
      </td></tr>
      <tr><td align="center" style="padding:4px 16px">
        <img src="cid:${t.cid}" width="220" height="220" alt="QR code du billet ${esc(formatCode(t.code))}" style="display:block;width:220px;height:220px;border:0">
      </td></tr>
      <tr><td align="center" style="padding:6px 16px 2px;font:700 18px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:${INK};letter-spacing:.12em">
        ${esc(formatCode(t.code))}
      </td></tr>
      <tr><td align="center" style="padding:2px 16px 18px;font:14px/1.5 ${FONT}">
        <a href="${esc(t.url)}" style="color:${INK}">Ouvrir le billet dans le navigateur</a>
      </td></tr>
    </table>
  </td></tr>`,
    )
    .join('')

  const html = layout({
    title: subject,
    preheader: `${many ? `Vos ${tickets.length} billets` : 'Votre billet'} pour ${event.name}. Présentez le QR code à l’entrée.`,
    body: `<tr><td style="padding:32px 28px 20px;font:16px/1.6 ${FONT};color:${INK}">
    <p style="margin:0 0 6px;font:600 13px/1.4 ${FONT};color:#059669">C’est confirmé${name ? `, ${esc(name)}` : ''} !</p>
    <h1 style="margin:0;font:700 26px/1.2 ${FONT};color:${INK}">${esc(event.name)}</h1>
    ${when.map((line) => `<p style="margin:6px 0 0;font:15px/1.5 ${FONT};color:${MUTED}">${esc(line)}</p>`).join('')}
    <p style="margin:20px 0 0">Merci pour votre paiement. Présentez ${many ? 'chaque QR code' : 'ce QR code'} à l’entrée. Chaque code n’est valable qu’une fois : ne ${many ? 'les' : 'le'} partagez pas publiquement.</p>
  </td></tr>
  ${ticketBlocks}
  <tr><td style="padding:0 28px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;border-radius:14px;font:14px/1.6 ${FONT};color:#3f3f46">
      <tr><td colspan="2" style="padding:14px 16px 4px;font-weight:700;color:${INK}">Reçu</td></tr>
      <tr><td style="padding:2px 16px">Commande</td><td align="right" style="padding:2px 16px">#${order.id}</td></tr>
      <tr><td style="padding:2px 16px">Nom</td><td align="right" style="padding:2px 16px">${esc(order.buyerName)}</td></tr>
      <tr><td style="padding:2px 16px">Billets</td><td align="right" style="padding:2px 16px">${order.quantity}</td></tr>
      <tr><td style="padding:2px 16px">Payé en espèces</td><td align="right" style="padding:2px 16px;font-weight:700;color:${INK}">${esc(paid)}</td></tr>
      <tr><td style="padding:2px 16px 14px">Date</td><td align="right" style="padding:2px 16px 14px">${esc(paidOn)}</td></tr>
    </table>
  </td></tr>
  ${event.info ? `<tr><td style="padding:0 28px 24px;font:14px/1.6 ${FONT};color:#3f3f46">${paragraphs(event.info)}</td></tr>` : ''}
  ${event.contactEmail ? `<tr><td style="padding:0 28px 28px;font:13px/1.6 ${FONT};color:${MUTED}">Une question ? Répondez à cet e-mail ou écrivez à <a href="mailto:${esc(event.contactEmail)}" style="color:${INK}">${esc(event.contactEmail)}</a>.</td></tr>` : ''}`,
  })

  const text = [
    event.name,
    ...when,
    '',
    `C’est confirmé${name ? `, ${name}` : ''} !`,
    '',
    'Merci pour votre paiement. Présentez le QR code à l’entrée ; chaque code n’est valable qu’une fois.',
    '',
    ...tickets.flatMap((t) => [
      `${many ? `Billet ${t.seq} sur ${tickets.length}` : 'Billet'} : ${formatCode(t.code)}`,
      t.url,
      '',
    ]),
    'Reçu',
    `Commande n° ${order.id} - ${order.buyerName}`,
    `${order.quantity} billet(s), payé en espèces : ${paid}`,
    `Date : ${paidOn}`,
    ...(event.info ? ['', event.info] : []),
    ...(event.contactEmail ? ['', `Une question ? Écrivez à ${event.contactEmail}`] : []),
  ].join('\n')

  return { html, text }
}
