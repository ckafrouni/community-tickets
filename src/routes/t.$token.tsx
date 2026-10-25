import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Check, MapPin, TicketX } from 'lucide-react'
import { useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  DateTile,
  EmptyState,
  EventCover,
  IconTile,
  LocalTime,
  QrImage,
  Spinner,
} from '#/components/ui'
import { scanTicketFn, undoCheckInFn } from '#/functions/door.functions'
import { getPublicTicketFn } from '#/functions/ticket.functions'
import { describeEventDate, formatCode, parseEventDate } from '#/lib/format'
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
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
        <EmptyState icon={<TicketX />} title="Ticket not found">
          <p>This link isn't a valid ticket. Open the complete link from your email.</p>
        </EmptyState>
      </div>
    )
  }

  const { event, ticket, qrSvg, staff } = data
  const code = formatCode(ticket.code)
  const when = parseEventDate(event.startsAt)

  return (
    <div className="mx-auto max-w-md px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))] print:pt-0">
      <EventCover name={event.name} className="aspect-[2/1] w-full rounded-3xl text-5xl print:hidden" />

      <h1 className="mt-5 text-[28px] leading-tight font-bold tracking-tight">{event.name}</h1>

      <div className="mt-4 space-y-3">
        {event.startsAt && (
          <div className="flex items-center gap-3">
            {when ? <DateTile when={when} /> : null}
            <div className="min-w-0">
              <p className="font-semibold">{when ? when.date : describeEventDate(event.startsAt)}</p>
              {when && <p className="text-sm text-zinc-500">{when.time}</p>}
            </div>
          </div>
        )}
        {event.venue && (
          <div className="flex items-center gap-3">
            <IconTile>
              <MapPin />
            </IconTile>
            <p className="min-w-0 font-semibold break-words">{event.venue}</p>
          </div>
        )}
      </div>

      <Card className="mt-6 p-5 text-center print:shadow-none">
        {ticket.cancelled ? (
          <Badge tone="red">Cancelled</Badge>
        ) : ticket.checkedInAt ? (
          <Badge>Checked in</Badge>
        ) : (
          <Badge tone="green">
            <Check className="size-3.5" strokeWidth={3} /> You're in
          </Badge>
        )}
        <div className={ticket.cancelled ? 'opacity-20' : undefined}>
          <QrImage svg={qrSvg} label={`Ticket QR code ${code}`} className="mx-auto mt-3 max-w-64" />
        </div>
        <p className="font-mono text-xl font-bold tracking-widest">{code}</p>
        <div className="mt-4 border-t border-dashed border-zinc-200 pt-4">
          <p className="text-lg font-semibold break-words">{ticket.buyerName}</p>
          <p className="text-sm text-zinc-500">
            {ticket.quantity > 1 ? `Ticket ${ticket.seq} of ${ticket.quantity} · ` : ''}Order #{ticket.orderId} · Paid
          </p>
        </div>
        <p className="mt-4 text-sm text-zinc-500">
          {ticket.cancelled ? (
            'This ticket has been cancelled.'
          ) : ticket.checkedInAt ? (
            <>
              Scanned at the entrance on <LocalTime iso={ticket.checkedInAt} />.
            </>
          ) : (
            'Show this code at the entrance. It can be scanned once.'
          )}
        </p>
      </Card>

      {event.info && <p className="mt-5 px-1 text-[15px] whitespace-pre-line text-zinc-600">{event.info}</p>}

      {staff && (
        <StaffPanel
          eventId={staff.eventId}
          ticketId={staff.ticketId}
          checkedIn={ticket.checkedInAt !== null}
          cancelled={ticket.cancelled}
        />
      )}

      <p className="mt-6 text-center text-sm text-zinc-400 print:hidden">
        Tip: take a screenshot so you have your ticket at the door.
      </p>
    </div>
  )
}

function StaffPanel({
  eventId,
  ticketId,
  checkedIn,
  cancelled,
}: {
  eventId: string
  ticketId: string
  checkedIn: boolean
  cancelled: boolean
}) {
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
    <section className="mt-6 space-y-3 rounded-3xl bg-zinc-900 p-4 text-white print:hidden" aria-label="Staff controls">
      <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Staff</p>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {cancelled ? (
        <p className="text-sm text-red-300">Cancelled order: do not admit.</p>
      ) : checkedIn ? (
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await undoCheckInFn({ data: { eventId, ticketId } })
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
              const result = await scanTicketFn({ data: { eventId, token } })
              if (result.status === 'checked_in') return { tone: 'green', text: 'Checked in. Welcome!' }
              if (result.status === 'already_checked_in') return { tone: 'amber', text: 'Already checked in.' }
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
