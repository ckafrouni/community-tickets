import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Alert, Button, Card, Field, Input, PageHeader, Spinner, Textarea } from '#/components/ui'
import { createSaleFn } from '#/functions/orders.functions'
import { getSettingsFn } from '#/functions/settings.functions'
import { formatMoney, inputToMinor, minorToInput, plural } from '#/lib/format'
import { errorMessage } from '#/lib/schemas'

export const Route = createFileRoute('/_staff/_admin/sell')({
  loader: () => getSettingsFn(),
  head: () => ({ meta: [{ title: 'Sell tickets' }] }),
  component: SellPage,
})

const EMPTY_BUYER = { buyerName: '', buyerEmail: '', buyerPhone: '', notes: '' }

function SellPage() {
  const { settings } = Route.useLoaderData()
  const navigate = useNavigate()
  const [buyer, setBuyer] = useState(EMPTY_BUYER)
  const [quantity, setQuantity] = useState(1)
  // null means "use quantity × price"; a string means the seller typed a custom amount.
  const [amountInput, setAmountInput] = useState<string | null>(null)
  const [sendEmail, setSendEmail] = useState(true)
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  const amountText = amountInput ?? minorToInput(quantity * settings.ticketPrice, settings.currency)
  const amount = inputToMinor(amountText, settings.currency)
  const hasEmail = buyer.buyerEmail.trim() !== ''
  const willEmail = sendEmail && hasEmail

  function update(field: keyof typeof EMPTY_BUYER) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setBuyer((b) => ({ ...b, [field]: e.target.value }))
  }

  function changeQuantity(next: number) {
    setQuantity(Math.min(50, Math.max(1, next || 1)))
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (amount === null) {
      setError('Enter the amount of cash you received.')
      return
    }
    setPending(true)
    setError(undefined)
    try {
      const { orderId } = await createSaleFn({
        data: { ...buyer, quantity, amount, sendEmail: willEmail },
      })
      await navigate({
        to: '/orders/$orderId',
        params: { orderId: String(orderId) },
        search: { created: true },
      })
    } catch (e) {
      setError(errorMessage(e))
      setPending(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Record a cash sale"
        description="Take the cash, fill in the buyer, and their tickets are issued instantly."
      />

      {!settings.eventDate && (
        <div className="mb-4">
          <Alert tone="indigo" title="Set up your event first">
            Add the event date and venue in{' '}
            <Link to="/settings" className="font-semibold underline">
              Settings
            </Link>{' '}
            so they appear on tickets and emails.
          </Alert>
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="space-y-4">
          <Field label="Buyer name">
            <Input
              required
              autoComplete="off"
              value={buyer.buyerName}
              onChange={update('buyerName')}
              placeholder="Jane Doe"
            />
          </Field>
          <Field
            label="Email"
            hint={
              hasEmail ? undefined : 'Leave blank if they have no email; you can show the QR code on screen instead.'
            }
          >
            <Input
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              value={buyer.buyerEmail}
              onChange={update('buyerEmail')}
              placeholder="jane@example.com"
            />
          </Field>
          <Field label="Phone (optional)">
            <Input type="tel" autoComplete="off" value={buyer.buyerPhone} onChange={update('buyerPhone')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Number of tickets">
              <div className="flex">
                <Button
                  variant="secondary"
                  className="rounded-r-none"
                  aria-label="One fewer ticket"
                  onClick={() => changeQuantity(quantity - 1)}
                >
                  −
                </Button>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50}
                  value={quantity}
                  onChange={(e) => changeQuantity(Number(e.target.value))}
                  className="rounded-none text-center tabular-nums"
                />
                <Button
                  variant="secondary"
                  className="rounded-l-none"
                  aria-label="One more ticket"
                  onClick={() => changeQuantity(quantity + 1)}
                >
                  +
                </Button>
              </div>
            </Field>
            <Field
              label={`Cash received (${settings.currency})`}
              hint={
                amountInput !== null ? (
                  <button
                    type="button"
                    className="text-indigo-600 hover:underline"
                    onClick={() => setAmountInput(null)}
                  >
                    Reset to {formatMoney(quantity * settings.ticketPrice, settings.currency)}
                  </button>
                ) : (
                  `${formatMoney(settings.ticketPrice, settings.currency)} per ticket`
                )
              }
              error={amount === null ? 'Enter a number, e.g. 20 or 12.50' : undefined}
            >
              <Input
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountInput(e.target.value)}
                className="tabular-nums"
              />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <Textarea
              value={buyer.notes}
              onChange={update('notes')}
              rows={2}
              placeholder="e.g. paid for her parents too"
            />
          </Field>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <Card className="space-y-4">
            <div>
              <p className="text-sm text-slate-600">Collect in cash</p>
              <p className="text-3xl font-bold tabular-nums">
                {amount === null ? '—' : formatMoney(amount, settings.currency)}
              </p>
              <p className="text-sm text-slate-600">{plural(quantity, 'ticket')}</p>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-indigo-600"
                checked={willEmail}
                disabled={!hasEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
              <span>Email the ticket{quantity > 1 ? 's' : ''} to the buyer</span>
            </label>
            {error && <Alert tone="red">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" disabled={pending || amount === null}>
              {pending && <Spinner />} Confirm payment &amp; issue {quantity > 1 ? 'tickets' : 'ticket'}
            </Button>
          </Card>
        </div>
      </form>
    </>
  )
}
