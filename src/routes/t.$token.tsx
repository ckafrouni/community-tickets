import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Check, MapPin, TicketX } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { DateTile, EventCover, IconTile, LocalTime, QrImage } from '#/components/common'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { Spinner } from '#/components/ui/spinner'
import { scanTicketFn, undoCheckInFn } from '#/functions/check-in.functions'
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
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TicketX />
            </EmptyMedia>
            <EmptyTitle>Ticket not found</EmptyTitle>
            <EmptyDescription>This link isn't a valid ticket. Open the complete link from your email.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const { event, ticket, qrSvg, staff } = data
  const code = formatCode(ticket.code)
  const when = parseEventDate(event.startsAt)

  return (
    <div className="mx-auto max-w-md px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))] print:pt-0">
      <EventCover name={event.name} className="aspect-[2/1] w-full rounded-4xl text-5xl print:hidden" />

      <h1 className="mt-5 font-heading text-[28px] leading-tight font-semibold tracking-tight">{event.name}</h1>

      <div className="mt-4 flex flex-col gap-3">
        {event.startsAt && (
          <div className="flex items-center gap-3">
            {when && <DateTile when={when} />}
            <div className="min-w-0">
              <p className="font-semibold">{when ? when.date : describeEventDate(event.startsAt)}</p>
              {when && <p className="text-sm text-muted-foreground">{when.time}</p>}
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

      <Card className="mt-6 print:shadow-none">
        <CardContent className="flex flex-col items-center gap-3 text-center">
          {ticket.cancelled ? (
            <Badge variant="destructive">Cancelled</Badge>
          ) : ticket.checkedInAt ? (
            <Badge variant="secondary">Checked in</Badge>
          ) : (
            <Badge variant="success">
              <Check /> You're in
            </Badge>
          )}
          <div className={ticket.cancelled ? 'w-full opacity-20' : 'w-full'}>
            <QrImage svg={qrSvg} label={`Ticket QR code ${code}`} className="mx-auto max-w-64" />
          </div>
          <p className="font-mono text-xl font-semibold tracking-widest">{code}</p>
          <div className="w-full border-t border-dashed pt-4">
            <p className="text-lg font-semibold break-words">{ticket.buyerName}</p>
            <p className="text-sm text-muted-foreground">
              {ticket.quantity > 1 ? `Ticket ${ticket.seq} of ${ticket.quantity} · ` : ''}Order #{ticket.orderId} · Paid
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {ticket.cancelled ? (
              'This ticket has been cancelled.'
            ) : ticket.checkedInAt ? (
              <>
                Scanned at the entrance <LocalTime iso={ticket.checkedInAt} mode="ago" />.
              </>
            ) : (
              'Show this code at the entrance. It can be scanned once.'
            )}
          </p>
        </CardContent>
      </Card>

      {event.info && <p className="mt-5 px-1 text-[15px] whitespace-pre-line text-muted-foreground">{event.info}</p>}

      {staff && (
        <StaffPanel
          eventId={staff.eventId}
          ticketId={staff.ticketId}
          checkedIn={ticket.checkedInAt !== null}
          cancelled={ticket.cancelled}
        />
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground print:hidden">
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

  async function run(fn: () => Promise<{ ok: boolean; text: string }>) {
    setBusy(true)
    try {
      const { ok, text } = await fn()
      if (ok) toast.success(text)
      else toast.error(text)
      await router.invalidate()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Staff controls" className="mt-6 print:hidden">
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs font-medium tracking-wide uppercase opacity-70">Staff</p>
          {cancelled ? (
            <p className="text-sm">Cancelled order: do not admit.</p>
          ) : checkedIn ? (
            <Button
              variant="secondary"
              size="lg"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await undoCheckInFn({ data: { eventId, ticketId } })
                  return { ok: true, text: 'Check-in undone.' }
                })
              }
            >
              {busy && <Spinner />} Undo check-in
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="lg"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const result = await scanTicketFn({ data: { eventId, token } })
                  if (result.status === 'checked_in') return { ok: true, text: 'Checked in. Welcome!' }
                  if (result.status === 'already_checked_in') return { ok: false, text: 'Already checked in.' }
                  return { ok: false, text: 'This ticket is not valid.' }
                })
              }
            >
              {busy && <Spinner />} Check in now
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
