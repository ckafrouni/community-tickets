import { createFileRoute } from '@tanstack/react-router'
import { formatCode, minorToInput } from '#/lib/format'
import { getStaffSession } from '#/server/auth/auth.server'
import { exportOrders } from '#/server/repo.server'

function csvCell(value: string | number): string {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const Route = createFileRoute('/api/orders.csv')({
  server: {
    handlers: {
      GET: async () => {
        if ((await getStaffSession())?.role !== 'admin') {
          return new Response('Unauthorized', { status: 401 })
        }
        const header = [
          'order',
          'date',
          'name',
          'email',
          'phone',
          'tickets',
          'amount',
          'currency',
          'status',
          'checked_in',
          'email_status',
          'ticket_codes',
          'notes',
        ]
        const lines = (await exportOrders()).map((r) =>
          [
            r.id,
            r.createdAt,
            r.buyerName,
            r.buyerEmail,
            r.buyerPhone,
            r.quantity,
            minorToInput(r.amount, r.currency),
            r.currency,
            r.cancelledAt ? 'cancelled' : 'paid',
            r.checkedIn,
            r.emailStatus,
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
            'Content-Disposition': `attachment; filename="ticket-sales-${date}.csv"`,
            'Cache-Control': 'no-store',
          },
        })
      },
    },
  },
})
