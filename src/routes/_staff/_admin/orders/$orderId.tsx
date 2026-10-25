import { Link, createFileRoute, notFound, useHydrated, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmailStatusBadge,
  Field,
  Input,
  LocalTime,
  PageHeader,
  QrImage,
  Spinner,
  Textarea,
} from '#/components/ui'
import { checkInTicketFn, undoCheckInFn } from '#/functions/door.functions'
import { getOrderFn, resendEmailFn, setOrderCancelledFn, updateOrderFn } from '#/functions/orders.functions'
import { formatCode, formatMoney, plural } from '#/lib/format'
import { errorMessage } from '#/lib/schemas'
import type { OrderDetail, OrderTicket } from '#/lib/types'

export const Route = createFileRoute('/_staff/_admin/orders/$orderId')({
  validateSearch: (search: Record<string, unknown>): { created?: boolean } => ({
    created: search.created === true || search.created === 'true' ? true : undefined,
  }),
  loader: ({ params }) => {
    const id = Number(params.orderId)
    if (!Number.isInteger(id) || id <= 0) throw notFound()
    return getOrderFn({ data: { id } })
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `Order #${loaderData.id}` : 'Order' }] }),
  notFoundComponent: () => (
    <Card className="py-12 text-center">
      <p className="font-semibold">Order not found</p>
      <Link to="/orders" className="mt-2 inline-block text-indigo-600 hover:underline">
        Back to orders
      </Link>
    </Card>
  ),
  component: OrderPage,
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

function OrderPage() {
  const order = Route.useLoaderData()
  const { created } = Route.useSearch()
  const { busy, message, run } = useAction()
  const cancelled = order.cancelledAt !== null

  function resend() {
    return run('email', async () => {
      const result = await resendEmailFn({ data: { id: order.id } })
      switch (result.status) {
        case 'sent':
          return { tone: 'green', text: `Tickets emailed to ${order.buyerEmail}.` }
        case 'failed':
          return { tone: 'red', text: `Email failed: ${result.error}` }
        default:
          return { tone: 'amber', text: 'This order has no email address. Add one first.' }
      }
    })
  }

  return (
    <>
      {created && <CreatedBanner order={order} />}

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            Order #{order.id}
            {cancelled ? <Badge tone="red">Cancelled</Badge> : <Badge tone="green">Paid</Badge>}
          </span>
        }
        description={
          <>
            {plural(order.quantity, 'ticket')} · {formatMoney(order.amount, order.currency)} cash ·{' '}
            <LocalTime iso={order.createdAt} />
          </>
        }
        actions={
          <>
            <Link
              to="/orders"
              className="inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              All orders
            </Link>
            {created && (
              <Link
                to="/sell"
                className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Sell another
              </Link>
            )}
          </>
        }
      />

      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      {cancelled && (
        <div className="mb-4">
          <Alert tone="red" title="This order is cancelled">
            Its tickets are rejected at the door.
            {order.cancelReason && <> Reason: {order.cancelReason}</>}
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section aria-label="Tickets" className="grid content-start items-start gap-4 sm:grid-cols-2">
          {order.tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} orderCancelled={cancelled} />
          ))}
        </section>

        <div className="space-y-4">
          <BuyerCard order={order} />

          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Email</h2>
              <EmailStatusBadge status={order.emailStatus} />
            </div>
            {order.emailUpdatedAt && (
              <p className="text-sm text-slate-600">
                Last attempt: <LocalTime iso={order.emailUpdatedAt} />
              </p>
            )}
            {order.emailStatus === 'failed' && order.emailError && (
              <p className="rounded bg-red-50 p-2 font-mono text-xs break-words text-red-800">{order.emailError}</p>
            )}
            <Button
              variant="secondary"
              className="w-full"
              onClick={resend}
              disabled={!order.buyerEmail || cancelled || busy !== null}
            >
              {busy === 'email' && <Spinner />}
              {order.emailStatus === 'sent' ? 'Resend tickets' : 'Email tickets'}
            </Button>
            {!order.buyerEmail && <p className="text-xs text-slate-500">Add an email address to send tickets.</p>}
          </Card>

          <CancelCard order={order} />
        </div>
      </div>
    </>
  )
}

function CreatedBanner({ order }: { order: OrderDetail }) {
  const collect = formatMoney(order.amount, order.currency)
  const fallback = 'Let the buyer scan the QR code on screen with their phone camera, or share the ticket link.'
  return (
    <div className="mb-6 space-y-2">
      <Alert tone="green" title={`Sale recorded: ${collect} cash for ${plural(order.quantity, 'ticket')}`} />
      {order.emailStatus === 'sent' && <Alert tone="green">Tickets emailed to {order.buyerEmail}.</Alert>}
      {order.emailStatus === 'failed' && (
        <Alert tone="red" title="The email could not be sent">
          {order.emailError} You can retry below. {fallback}
        </Alert>
      )}
      {order.emailStatus === 'not_sent' && <Alert tone="indigo">No email was sent. {fallback}</Alert>}
    </div>
  )
}

function TicketCard({ ticket, orderCancelled }: { ticket: OrderTicket; orderCancelled: boolean }) {
  const { busy, message, run } = useAction()
  const [enlarged, setEnlarged] = useState(false)
  const [copied, setCopied] = useState(false)
  const hydrated = useHydrated()
  const canShare = hydrated && 'share' in navigator

  async function copy() {
    await navigator.clipboard.writeText(ticket.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="flex flex-col gap-3 !p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-600">
          Ticket {ticket.seq} of {ticket.quantity}
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
        onClick={() => setEnlarged(true)}
        className="mx-auto block w-44 rounded-lg bg-white p-1 ring-1 ring-slate-200 hover:ring-indigo-400"
        aria-label="Show QR code full screen"
      >
        <QrImage svg={ticket.qrSvg} label={`QR code for ticket ${formatCode(ticket.code)}`} />
      </button>
      <p className="text-center font-mono text-lg font-bold tracking-widest">{formatCode(ticket.code)}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? 'Copied!' : 'Copy link'}
        </Button>
        {canShare && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigator.share({ title: 'Your ticket', url: ticket.url }).catch(() => {})}
          >
            Share
          </Button>
        )}
        {!orderCancelled &&
          (ticket.checkedInAt ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => run('undo', () => undoCheckInFn({ data: { ticketId: ticket.id } }).then(() => {}))}
            >
              Undo check-in
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => run('in', () => checkInTicketFn({ data: { ticketId: ticket.id } }).then(() => {}))}
            >
              Check in
            </Button>
          ))}
      </div>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {enlarged && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Ticket QR code"
          onClick={() => setEnlarged(false)}
        >
          <QrImage
            svg={ticket.qrSvg}
            label={`QR code for ticket ${formatCode(ticket.code)}`}
            className="max-h-[70dvh] max-w-[70dvh]"
          />
          <p className="font-mono text-2xl font-bold tracking-widest">{formatCode(ticket.code)}</p>
          <p className="text-sm text-slate-500">
            Scan with your phone camera to save your ticket. Tap anywhere to close.
          </p>
        </div>
      )}
    </Card>
  )
}

function BuyerCard({ order }: { order: OrderDetail }) {
  const { busy, message, run } = useAction()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    buyerPhone: order.buyerPhone,
    notes: order.notes,
  })

  if (!editing) {
    return (
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Buyer</h2>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
        <dl className="space-y-2 text-sm">
          <Row label="Name">{order.buyerName}</Row>
          <Row label="Email">{order.buyerEmail || '—'}</Row>
          <Row label="Phone">{order.buyerPhone || '—'}</Row>
          {order.notes && <Row label="Notes">{order.notes}</Row>}
        </dl>
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
      </Card>
    )
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <Card>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void run('save', async () => {
            await updateOrderFn({ data: { id: order.id, ...form } })
            setEditing(false)
            return form.buyerEmail !== order.buyerEmail && form.buyerEmail
              ? { tone: 'amber', text: 'Saved. The email address changed, so remember to resend the tickets.' }
              : { tone: 'green', text: 'Saved.' }
          })
        }}
      >
        <h2 className="font-semibold">Edit buyer</h2>
        <Field label="Name">
          <Input required {...field('buyerName')} />
        </Field>
        <Field label="Email">
          <Input type="email" autoCapitalize="none" {...field('buyerEmail')} />
        </Field>
        <Field label="Phone">
          <Input type="tel" {...field('buyerPhone')} />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} {...field('notes')} />
        </Field>
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy !== null}>
            {busy === 'save' && <Spinner />} Save
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}

function CancelCard({ order }: { order: OrderDetail }) {
  const { busy, message, run } = useAction()
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')

  if (order.cancelledAt) {
    return (
      <Card className="space-y-3">
        <h2 className="font-semibold">Cancelled</h2>
        <p className="text-sm text-slate-600">
          Cancelled <LocalTime iso={order.cancelledAt} />. Reinstating makes the existing tickets valid again.
        </p>
        <Button
          variant="secondary"
          className="w-full"
          disabled={busy !== null}
          onClick={() =>
            run('reinstate', () =>
              setOrderCancelledFn({ data: { id: order.id, cancelled: false, reason: '' } }).then(() => {}),
            )
          }
        >
          Reinstate order
        </Button>
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
      </Card>
    )
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Cancel &amp; refund</h2>
      {!confirming ? (
        <>
          <p className="text-sm text-slate-600">
            Cancelling voids every ticket in this order. Return the cash yourself.
          </p>
          <Button variant="danger" className="w-full" onClick={() => setConfirming(true)}>
            Cancel order…
          </Button>
        </>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void run('cancel', () =>
              setOrderCancelledFn({ data: { id: order.id, cancelled: true, reason } }).then(() => ({
                tone: 'amber' as const,
                text: `Order cancelled. Refund ${formatMoney(order.amount, order.currency)} to ${order.buyerName}.`,
              })),
            )
          }}
        >
          <Field label="Reason (optional)">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. refunded, can't attend"
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={busy !== null}>
              {busy === 'cancel' && <Spinner />} Yes, cancel {plural(order.quantity, 'ticket')}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        </form>
      )}
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  )
}
