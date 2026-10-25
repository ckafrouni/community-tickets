import { createFileRoute } from '@tanstack/react-router'
import { formatCode, minorToInput } from '#/lib/format'
import { getEventAccess } from '#/server/access.server'
import { getSessionUser } from '#/server/auth/auth.server'
import { exportOrders } from '#/server/repo.server'

const EMAIL_STATUS = { sent: 'envoye', failed: 'echec', not_sent: 'non_envoye' } as const

function csvCell(value: string | number): string {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
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
          'date',
          'nom',
          'email',
          'telephone',
          'billets',
          'montant',
          'devise',
          'statut',
          'arrives',
          'statut_email',
          'codes_billets',
          'notes',
        ]
        const lines = (await exportOrders(access.event.id)).map((r) =>
          [
            r.id,
            r.createdAt,
            r.buyerName,
            r.buyerEmail,
            r.buyerPhone,
            r.quantity,
            minorToInput(r.amount, r.currency),
            r.currency,
            r.cancelledAt ? 'annulee' : 'payee',
            r.checkedIn,
            EMAIL_STATUS[r.emailStatus],
            r.ticketCodes.map(formatCode).join(' '),
            r.notes,
          ]
            .map(csvCell)
            .join(','),
        )
        const csv = `\uFEFF${[header.join(','), ...lines].join('\r\n')}\r\n`
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
