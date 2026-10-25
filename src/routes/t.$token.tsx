import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Alert, Button, LocalTime, QrImage, Spinner } from '#/components/ui'
import { scanTicketFn, undoCheckInFn } from '#/functions/door.functions'
import { getPublicTicketFn } from '#/functions/ticket.functions'
import { formatCode } from '#/lib/format'
import { errorMessage } from '#/lib/schemas'

export const Route = createFileRoute('/t/$token')({
  loader: ({ params }) => getPublicTicketFn({ data: { token: params.token } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.valid ? `Your ticket · ${loaderData.event.name}` : 'Ticket not found' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: TicketPage,
})

function TicketPage() {
  const data = Route.useLoaderData()

  if (!data.valid) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">✕</div>
        <h1 className="mt-4 text-xl font-bold">Ticket not found</h1>
        <p className="mt-2 text-slate-600">
          This link isn't a valid ticket. Check that you opened the complete link from your email.
        </p>
      </div>
    )
  }

  const { event, ticket, qrSvg, staff } = data
  const code = formatCode(ticket.code)

  return (
    <div className="min-h-dvh bg-indigo-600 px-4 pt-8 pb-12 print:bg-white">
      <div className="mx-auto max-w-sm">
        <header className="mb-5 text-center text-white print:text-slate-900">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          {(event.date || event.venue) && (
            <p className="mt-1 text-indigo-100 print:text-slate-600">
              {[event.date, event.venue].filter(Boolean).join(' · ')}
            </p>
          )}
        </header>

        <main className="overflow-hidden rounded-2xl bg-white shadow-xl print:shadow-none print:ring-1 print:ring-slate-300">
          <div className="px-6 pt-5 text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">
              Admit one{ticket.quantity > 1 && ` · Ticket ${ticket.seq} of ${ticket.quantity}`}
            </p>
            <div className={ticket.cancelled ? 'opacity-25' : undefined}>
              <QrImage svg={qrSvg} label={`Ticket QR code ${code}`} className="mx-auto mt-3 max-w-72" />
            </div>
            <p className="mt-1 font-mono text-xl font-bold tracking-widest">{code}</p>
          </div>

          <div className="relative my-5 border-t-2 border-dashed border-slate-200">
            <span className="absolute -top-3 -left-3 size-6 rounded-full bg-indigo-600 print:hidden" />
            <span className="absolute -top-3 -right-3 size-6 rounded-full bg-indigo-600 print:hidden" />
          </div>

          <div className="space-y-4 px-6 pb-6">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Name</dt>
                <dd className="font-semibold break-words">{ticket.buyerName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Order</dt>
                <dd className="font-semibold">#{ticket.orderId} · Paid</dd>
              </div>
            </dl>

            {ticket.cancelled ? (
              <Alert tone="red" title="This ticket has been cancelled" />
            ) : ticket.checkedInAt ? (
              <Alert tone="neutral" title="Already checked in">
                Scanned at the entrance on <LocalTime iso={ticket.checkedInAt} />.
              </Alert>
            ) : (
              <Alert tone="green" title="Valid ticket">
                Show this QR code at the entrance. It can only be scanned once.
              </Alert>
            )}

            {event.info && <p className="text-sm whitespace-pre-line text-slate-600">{event.info}</p>}
          </div>
        </main>

        {staff && (
          <StaffPanel ticketId={staff.ticketId} checkedIn={ticket.checkedInAt !== null} cancelled={ticket.cancelled} />
        )}

        <p className="mt-5 text-center text-sm text-indigo-100 print:hidden">
          Tip: take a screenshot or bookmark this page so you have it at the door.
        </p>
      </div>
    </div>
  )
}

function StaffPanel({ ticketId, checkedIn, cancelled }: { ticketId: string; checkedIn: boolean; cancelled: boolean }) {
  const { token } = Route.useParams()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'green' | 'amber' | 'red'; text: string }>()

  async function run(fn: () => Promise<{ tone: 'green' | 'amber' | 'red'; text: string }>) {
    setBusy(true)
    try {
      setMessage(await fn())
      await router.invalidate()
    } catch (e) {
      setMessage({ tone: 'red', text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-4 space-y-3 rounded-2xl bg-white/95 p-4 shadow print:hidden" aria-label="Staff controls">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Staff controls</p>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {cancelled ? (
        <p className="text-sm text-red-700">Cancelled order: do not admit.</p>
      ) : checkedIn ? (
        <Button
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await undoCheckInFn({ data: { ticketId } })
              return { tone: 'amber', text: 'Check-in undone.' }
            })
          }
        >
          {busy && <Spinner />} Undo check-in
        </Button>
      ) : (
        <Button
          variant="success"
          size="lg"
          className="w-full"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const result = await scanTicketFn({ data: { token } })
              if (result.status === 'checked_in') return { tone: 'green', text: 'Checked in. Welcome!' }
              if (result.status === 'already_checked_in')
                return { tone: 'amber', text: 'This ticket was already checked in.' }
              return { tone: 'red', text: 'This ticket is not valid.' }
            })
          }
        >
          {busy && <Spinner />} Check in now
        </Button>
      )}
    </section>
  )
}
