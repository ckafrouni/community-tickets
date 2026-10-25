import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Field,
  Form,
  Input,
  PageHeader,
  SectionTitle,
  Spinner,
  StickyBar,
  Switch,
  Textarea,
  cx,
} from '#/components/ui'
import { createSaleFn } from '#/functions/orders.functions'
import { currencySymbol, formatMoney, inputToMinor, minorToInput, plural } from '#/lib/format'
import { errorMessage } from '#/lib/schemas'

export const Route = createFileRoute('/_app/events/$eventId/_host/sell')({
  head: () => ({ meta: [{ title: 'Sell tickets' }] }),
  component: SellPage,
})

const EMPTY_BUYER = { buyerName: '', buyerEmail: '', buyerPhone: '', notes: '' }

function SellPage() {
  const { event } = Route.useRouteContext()
  const navigate = useNavigate()
  const [buyer, setBuyer] = useState(EMPTY_BUYER)
  const [quantity, setQuantity] = useState(1)
  const [amountInput, setAmountInput] = useState<string | null>(null)
  const [sendEmail, setSendEmail] = useState(true)
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  const suggested = quantity * event.ticketPrice
  const amountText = amountInput ?? minorToInput(suggested, event.currency)
  const amount = inputToMinor(amountText, event.currency)
  const hasEmail = buyer.buyerEmail.trim() !== ''
  const willEmail = sendEmail && hasEmail
  const symbol = currencySymbol(event.currency)

  function update(field: keyof typeof EMPTY_BUYER) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setBuyer((b) => ({ ...b, [field]: e.target.value }))
  }

  function changeQuantity(next: number) {
    setQuantity(Math.min(50, Math.max(1, next || 1)))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (amount === null) {
      setError('Enter the amount of cash you received.')
      return
    }
    setPending(true)
    setError(undefined)
    try {
      const { orderId } = await createSaleFn({
        data: { eventId: event.id, ...buyer, quantity, amount, sendEmail: willEmail },
      })
      await navigate({
        to: '/events/$eventId/guests/$orderId',
        params: { eventId: event.id, orderId: String(orderId) },
        search: { created: true },
      })
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
    }
  }

  return (
    <>
      <PageHeader title="Sell tickets" description="Take the cash, then issue the tickets." />

      {!event.startsAt && (
        <div className="mb-5">
          <Alert title="Add the date and place">
            Guests see them on their tickets.{' '}
            <Link
              to="/events/$eventId/settings"
              params={{ eventId: event.id }}
              className="font-semibold text-zinc-900 underline"
            >
              Edit event
            </Link>
          </Alert>
        </div>
      )}

      <Form onSubmit={onSubmit} className="space-y-5">
        <section>
          <SectionTitle>Buyer</SectionTitle>
          <Card className="space-y-4">
            <Field label="Name">
              <Input
                required
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                value={buyer.buyerName}
                onChange={update('buyerName')}
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Email" hint={hasEmail ? undefined : 'Optional. Without one, show the QR code on screen.'}>
              <Input
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                enterKeyHint="next"
                value={buyer.buyerEmail}
                onChange={update('buyerEmail')}
                placeholder="jane@example.com"
              />
            </Field>
            <Field label="Phone (optional)">
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={buyer.buyerPhone}
                onChange={update('buyerPhone')}
              />
            </Field>
          </Card>
        </section>

        <section>
          <SectionTitle>Tickets</SectionTitle>
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[15px] font-medium">Quantity</p>
                <p className="text-[13px] text-zinc-500">{formatMoney(event.ticketPrice, event.currency)} each</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="soft"
                  size="icon"
                  aria-label="One fewer ticket"
                  disabled={quantity <= 1}
                  onClick={() => changeQuantity(quantity - 1)}
                >
                  <Minus className="size-5" />
                </Button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50}
                  aria-label="Number of tickets"
                  value={quantity}
                  onChange={(e) => changeQuantity(Number(e.target.value))}
                  className="w-12 [appearance:textfield] bg-transparent text-center text-xl font-semibold tabular-nums focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <Button
                  variant="soft"
                  size="icon"
                  aria-label="One more ticket"
                  disabled={quantity >= 50}
                  onClick={() => changeQuantity(quantity + 1)}
                >
                  <Plus className="size-5" />
                </Button>
              </div>
            </div>
            <Field
              label="Cash received"
              hint={
                amountInput !== null && amount !== suggested ? (
                  <button
                    type="button"
                    className="font-medium text-zinc-900 underline"
                    onClick={() => setAmountInput(null)}
                  >
                    Reset to {formatMoney(suggested, event.currency)}
                  </button>
                ) : undefined
              }
              error={amount === null ? 'Enter a number, e.g. 20 or 12.50' : undefined}
            >
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-400">
                  {symbol}
                </span>
                <Input
                  inputMode="decimal"
                  value={amountText}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className={cx(symbol.length > 1 ? 'pl-14' : 'pl-9', 'tabular-nums')}
                />
              </div>
            </Field>
            <Field label="Notes (optional)">
              <Textarea
                value={buyer.notes}
                onChange={update('notes')}
                rows={2}
                placeholder="e.g. paid for her parents too"
              />
            </Field>
          </Card>
        </section>

        <Card>
          <Switch
            label={quantity > 1 ? 'Email the tickets' : 'Email the ticket'}
            description={hasEmail ? `To ${buyer.buyerEmail.trim()}` : 'Add an email address first'}
            checked={willEmail}
            disabled={!hasEmail}
            onChange={setSendEmail}
          />
        </Card>

        <StickyBar aboveTabBar>
          {error && <Alert tone="red">{error}</Alert>}
          <Button type="submit" size="lg" className="w-full" disabled={pending || amount === null}>
            {pending && <Spinner />}
            {amount === null
              ? 'Enter the cash received'
              : `Confirm ${formatMoney(amount, event.currency)} · ${plural(quantity, 'ticket')}`}
          </Button>
        </StickyBar>
      </Form>
    </>
  )
}
