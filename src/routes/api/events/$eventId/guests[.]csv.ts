import { createFileRoute } from '@tanstack/react-router'
import { formatCode, minorToInput } from '#/lib/format'
import { getEventAccess } from '#/server/access.server'
import { getSessionUser } from '#/server/auth/auth.server'
import { paymentReference, paymentStatus } from '#/lib/payments'
import { typeSummary } from '#/server/email-template.server'
import { exportOrders } from '#/server/repo.server'

const EMAIL_STATUS = { sent: 'envoye', failed: 'echec', not_sent: 'non_envoye' } as const
const STATUS = { paid: 'payee', partial: 'paiement_partiel', unpaid: 'a_payer' } as const

function csvCell(value: string | number): string {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const Route = createFileRoute('/api/events/$eventId/guests.csv')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const user = await getSessionUser()
        const access = user ? await getEventAccess(user, params.eventId) : null
        if (access?.role !== 'organizer') return new Response('Introuvable', { status: 404 })
        const header = [
          'commande',
          'reference',
          'date',
          'nom',
          'email',
          'telephone',
          'billets',
          'tarifs',
          'total',
          'paye',
          'reste',
          'devise',
          'statut',
          'arrives',
          'statut_email',
          'codes_billets',
          'notes',
        ]
        const money = (minor: number, currency: string) => minorToInput(minor, currency)
        const lines = (await exportOrders(access.event.id)).map((r) =>
          [
            r.id,
            paymentReference(r.id),
            r.createdAt,
            r.buyerName,
            r.buyerEmail,
            r.buyerPhone,
            r.quantity,
            typeSummary(r.ticketTypes),
            money(r.amount, r.currency),
            money(r.paid, r.currency),
            money(Math.max(r.amount - r.paid, 0), r.currency),
            r.currency,
            r.cancelledAt ? 'annulee' : STATUS[paymentStatus(r)],
            r.checkedIn,
            EMAIL_STATUS[r.emailStatus],
            r.ticketCodes.map(formatCode).join(' '),
            r.notes,
          ]
            .map(csvCell)
            .join(';'),
        )
        const csv = `\uFEFF${[header.join(';'), ...lines].join('\r\n')}\r\n`
        const date = new Date().toISOString().slice(0, 10)
        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="invites-${access.event.id}-${date}.csv"`,
            'Cache-Control': 'no-store',
          },
        })
      },
    },
  },
})
