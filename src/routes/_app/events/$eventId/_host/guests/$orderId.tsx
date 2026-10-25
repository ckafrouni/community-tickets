import { Link, createFileRoute, notFound, useHydrated, useRouter } from '@tanstack/react-router'
import { Ban, ChevronLeft, Copy, Mail, Pencil, RotateCcw, Share } from 'lucide-react'
import { useState } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmailStatusBadge,
  EmptyState,
  Field,
  Input,
  LocalTime,
  QrImage,
  SectionTitle,
  Sheet,
  Spinner,
  Textarea,
  backLinkClass,
  buttonClass,
  closeSheet,
} from '#/components/ui'
import { checkInTicketFn, undoCheckInFn } from '#/functions/door.functions'
import { getOrderFn, resendEmailFn, setOrderCancelledFn, updateOrderFn } from '#/functions/orders.functions'
import { formatCode, formatMoney, plural } from '#/lib/format'
import { errorMessage } from '#/lib/schemas'
import type { OrderDetail, OrderTicket } from '#/lib/types'

export const Route = createFileRoute('/_app/events/$eventId/_host/guests/$orderId')({
  validateSearch: (search: Record<string, unknown>): { created?: boolean } => ({
    created: search.created === true || search.created === 'true' ? true : undefined,
  }),
  loader: ({ params }) => {
    const id = Number(params.orderId)
    if (!Number.isInteger(id) || id <= 0) throw notFound()
    return getOrderFn({ data: { eventId: params.eventId, id } })
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? loaderData.buyerName : 'Guest' }] }),
  notFoundComponent: () => <EmptyState icon={<Ban />} title="Guest not found" />,
  component: GuestPage,
})

type Message = { tone: 'green' | 'red' | 'amber'; text: string }

function useAction() {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<Message>()
  async function run(key: string, fn: () => Promise<Message | void>) {
    setBusy(key)
    setMessage(undefined)
    try {
      const result = await fn()
      await router.invalidate()
      if (result) setMessage(result)
    } catch (e) {
      setMessage({ tone: 'red', text: errorMessage(e) })
    } finally {
      setBusy(null)
    }
  }
  return { busy, message, run }
}

function GuestPage() {
  const order = Route.useLoaderData()
  const { eventId } = Route.useParams()
  const { created } = Route.useSearch()
  const { busy, message, run } = useAction()
  const cancelled = order.cancelledAt !== null
  const arrived = order.checkedIn

  function resend() {
    return run('email', async () => {
      const result = await resendEmailFn({ data: { eventId, id: order.id } })
      switch (result.status) {
        case 'sent':
          return { tone: 'green', text: `Tickets emailed to ${order.buyerEmail}.` }
        case 'failed':
          return { tone: 'red', text: `Email failed: ${result.error}` }
        default:
          return { tone: 'amber', text: 'Add an email address first.' }
      }
    })
  }

  return (
    <>
      <Link to="/events/$eventId/guests" params={{ eventId }} className={backLinkClass}>
        <ChevronLeft className="size-5" /> Guests
      </Link>

      {created && <CreatedBanner order={order} eventId={eventId} />}

      <div className="mb-5 flex items-center gap-4">
        <Avatar name={order.buyerName} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl leading-tight font-bold tracking-tight">{order.buyerName}</h1>
          <p className="truncate text-[15px] text-zinc-500">
            {order.buyerEmail || order.buyerPhone || 'No contact details'}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {cancelled ? (
              <Badge tone="red">Cancelled</Badge>
            ) : (
              <Badge tone={arrived === order.quantity ? 'green' : arrived ? 'amber' : 'neutral'}>
                {arrived === order.quantity ? 'Arrived' : `${arrived}/${order.quantity} checked in`}
              </Badge>
            )}
            <EmailStatusBadge status={order.emailStatus} />
          </div>
        </div>
      </div>

      {cancelled && (
        <div className="mb-5">
          <Alert tone="red" title="This order is cancelled">
            Its tickets are refused at the door.{order.cancelReason && <> Reason: {order.cancelReason}</>}
          </Alert>
        </div>
      )}

      {message && (
        <div className="mb-5">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <section className="mb-6">
        <SectionTitle>{plural(order.quantity, 'ticket')}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {order.tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} eventId={eventId} orderCancelled={cancelled} />
          ))}
        </div>
      </section>

      <section className="mb-6">
        <SectionTitle>Payment</SectionTitle>
        <Card className="divide-y divide-zinc-100 !py-1">
          <Row label="Paid in cash">{formatMoney(order.amount, order.currency)}</Row>
          <Row label="Sold">
            <LocalTime iso={order.createdAt} />
          </Row>
          <Row label="Order">#{order.id}</Row>
          {order.buyerPhone && order.buyerEmail && <Row label="Phone">{order.buyerPhone}</Row>}
          {order.notes && <Row label="Notes">{order.notes}</Row>}
        </Card>
      </section>

      {order.emailStatus === 'failed' && order.emailError && (
        <div className="mb-5">
          <Alert tone="red" title="The last email failed">
            <span className="break-words">{order.emailError}</span>
          </Alert>
        </div>
      )}

      <section className="space-y-2">
        <SectionTitle>Actions</SectionTitle>
        <Button
          variant="secondary"
          size="lg"
          className="w-full justify-start"
          onClick={resend}
          disabled={!order.buyerEmail || cancelled || busy !== null}
        >
          {busy === 'email' ? <Spinner /> : <Mail className="size-5 text-zinc-500" />}
          {order.emailStatus === 'sent' ? 'Resend tickets' : 'Email tickets'}
        </Button>
        <Button variant="secondary" size="lg" className="w-full justify-start" popoverTarget="edit-guest">
          <Pencil className="size-5 text-zinc-500" /> Edit details
        </Button>
        <CancelButton order={order} eventId={eventId} />
      </section>

      <EditGuestSheet order={order} eventId={eventId} />
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-[15px]">
      <span className="shrink-0 text-zinc-500">{label}</span>
      <span className="min-w-0 text-right font-medium break-words">{children}</span>
    </div>
  )
}

function CreatedBanner({ order, eventId }: { order: OrderDetail; eventId: string }) {
  const sent = order.emailStatus === 'sent'
  return (
    <div className="mb-5 space-y-3">
      <Alert tone="green" title={`Sale recorded: ${formatMoney(order.amount, order.currency)} cash`}>
        {sent
          ? `Tickets emailed to ${order.buyerEmail}.`
          : 'Let the buyer scan a QR code below with their phone camera, or share the ticket link.'}
      </Alert>
      {order.emailStatus === 'failed' && (
        <Alert tone="red" title="The email could not be sent">
          {order.emailError} Try again below, or show the QR code on screen.
        </Alert>
      )}
      <Link to="/events/$eventId/sell" params={{ eventId }} className={buttonClass('primary', 'lg', 'w-full')}>
        Sell another
      </Link>
    </div>
  )
}

function TicketCard({
  ticket,
  eventId,
  orderCancelled,
}: {
  ticket: OrderTicket
  eventId: string
  orderCancelled: boolean
}) {
  const { busy, message, run } = useAction()
  const [copied, setCopied] = useState(false)
  const hydrated = useHydrated()
  const canShare = hydrated && 'share' in navigator
  const sheetId = `qr-${ticket.id}`

  async function copy() {
    await navigator.clipboard.writeText(ticket.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-500">
          {ticket.seq} of {ticket.quantity}
        </p>
        {orderCancelled ? (
          <Badge tone="red">Void</Badge>
        ) : ticket.checkedInAt ? (
          <Badge tone="green">
            In at&nbsp;
            <LocalTime iso={ticket.checkedInAt} mode="time" />
          </Badge>
        ) : (
          <Badge>Not checked in</Badge>
        )}
      </div>
      <button
        type="button"
        popoverTarget={sheetId}
        className="block w-48 rounded-xl p-1 ring-1 ring-zinc-200 transition hover:ring-zinc-400"
        aria-label="Show QR code full screen"
      >
        <QrImage svg={ticket.qrSvg} label={`QR code for ticket ${formatCode(ticket.code)}`} />
      </button>
      <p className="font-mono text-lg font-bold tracking-widest">{formatCode(ticket.code)}</p>
      <div className="grid w-full grid-cols-2 gap-2">
        {canShare ? (
          <Button
            variant="soft"
            size="sm"
            onClick={() => navigator.share({ title: 'Your ticket', url: ticket.url }).catch(() => {})}
          >
            <Share className="size-4" /> Share
          </Button>
        ) : (
          <Button variant="soft" size="sm" onClick={copy}>
            <Copy className="size-4" /> {copied ? 'Copied' : 'Copy link'}
          </Button>
        )}
        {!orderCancelled &&
          (ticket.checkedInAt ? (
            <Button
              variant="soft"
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                run('undo', () => undoCheckInFn({ data: { eventId, ticketId: ticket.id } }).then(() => {}))
              }
            >
              <RotateCcw className="size-4" /> Undo
            </Button>
          ) : (
            <Button
              variant="success"
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                run('in', () => checkInTicketFn({ data: { eventId, ticketId: ticket.id } }).then(() => {}))
              }
            >
              {busy === 'in' && <Spinner />} Check in
            </Button>
          ))}
      </div>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <Sheet id={sheetId} className="!max-h-dvh md:!max-w-md">
        <button type="button" className="block w-full" onClick={() => closeSheet(sheetId)}>
          <QrImage
            svg={ticket.qrSvg}
            label={`QR code for ticket ${formatCode(ticket.code)}`}
            className="mx-auto max-w-sm"
          />
          <p className="mt-3 text-center font-mono text-2xl font-bold tracking-widest">{formatCode(ticket.code)}</p>
          <p className="mt-2 text-center text-sm text-zinc-500">
            Scan with your phone camera to save your ticket. Tap to close.
          </p>
        </button>
      </Sheet>
    </Card>
  )
}

function EditGuestSheet({ order, eventId }: { order: OrderDetail; eventId: string }) {
  const router = useRouter()
  const [form, setForm] = useState({
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    buyerPhone: order.buyerPhone,
    notes: order.notes,
  })
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(undefined)
    try {
      await updateOrderFn({ data: { eventId, id: order.id, ...form } })
      await router.invalidate()
      closeSheet('edit-guest')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet id="edit-guest" title="Edit details">
      <form className="space-y-4" onSubmit={save}>
        <Field label="Name">
          <Input required autoCapitalize="words" {...field('buyerName')} />
        </Field>
        <Field
          label="Email"
          hint={
            form.buyerEmail.trim().toLowerCase() !== order.buyerEmail && form.buyerEmail
              ? 'Remember to resend the tickets after saving.'
              : undefined
          }
        >
          <Input type="email" inputMode="email" autoCapitalize="none" {...field('buyerEmail')} />
        </Field>
        <Field label="Phone">
          <Input type="tel" inputMode="tel" {...field('buyerPhone')} />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} {...field('notes')} />
        </Field>
        {error && <Alert tone="red">{error}</Alert>}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Spinner />} Save
        </Button>
      </form>
    </Sheet>
  )
}

function CancelButton({ order, eventId }: { order: OrderDetail; eventId: string }) {
  const { busy, message, run } = useAction()
  const [reason, setReason] = useState('')

  if (order.cancelledAt) {
    return (
      <>
        <Button
          variant="secondary"
          size="lg"
          className="w-full justify-start"
          disabled={busy !== null}
          onClick={() =>
            run('reinstate', () =>
              setOrderCancelledFn({ data: { eventId, id: order.id, cancelled: false, reason: '' } }).then(() => ({
                tone: 'green' as const,
                text: 'Order reinstated. Its tickets are valid again.',
              })),
            )
          }
        >
          {busy === 'reinstate' ? <Spinner /> : <RotateCcw className="size-5 text-zinc-500" />} Reinstate order
        </Button>
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
      </>
    )
  }

  return (
    <>
      <Button variant="danger" size="lg" className="w-full justify-start" popoverTarget="cancel-order">
        <Ban className="size-5" /> Cancel &amp; refund
      </Button>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Sheet id="cancel-order" title={`Cancel ${plural(order.quantity, 'ticket')}?`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            closeSheet('cancel-order')
            void run('cancel', () =>
              setOrderCancelledFn({ data: { eventId, id: order.id, cancelled: true, reason } }).then(() => ({
                tone: 'amber' as const,
                text: `Order cancelled. Refund ${formatMoney(order.amount, order.currency)} to ${order.buyerName}.`,
              })),
            )
          }}
        >
          <p className="text-[15px] text-zinc-600">
            Every ticket in this order stops working at the door. Return the {formatMoney(order.amount, order.currency)}{' '}
            cash yourself.
          </p>
          <Field label="Reason (optional)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. can't attend" />
          </Field>
          <Button type="submit" variant="danger" size="lg" className="w-full" disabled={busy !== null}>
            Cancel order
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={() => closeSheet('cancel-order')}>
            Keep it
          </Button>
        </form>
      </Sheet>
    </>
  )
}
