import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Info, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Form, PageHeader, SectionTitle, StickyBar } from '#/components/common'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { ButtonGroup } from '#/components/ui/button-group'
import { Card, CardContent } from '#/components/ui/card'
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '#/components/ui/input-group'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { createSaleFn } from '#/functions/orders.functions'
import { currencySymbol, formatMoney, inputToMinor, minorToInput, plural } from '#/lib/format'
import { errorMessage } from '#/lib/schemas'

export const Route = createFileRoute('/_app/events/$eventId/_organizer/sell')({
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
  const [pending, setPending] = useState(false)

  const suggested = quantity * event.ticketPrice
  const amountText = amountInput ?? minorToInput(suggested, event.currency)
  const amount = inputToMinor(amountText, event.currency)

  function update(field: keyof typeof EMPTY_BUYER) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setBuyer((b) => ({ ...b, [field]: e.target.value }))
  }

  function changeQuantity(next: number) {
    setQuantity(Math.min(50, Math.max(1, next || 1)))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (amount === null) return
    setPending(true)
    try {
      const { orderId } = await createSaleFn({ data: { eventId: event.id, ...buyer, quantity, amount } })
      await navigate({
        to: '/events/$eventId/guests/$orderId',
        params: { eventId: event.id, orderId: String(orderId) },
        search: { created: true },
      })
    } catch (err) {
      toast.error(errorMessage(err))
      setPending(false)
    }
  }

  return (
    <>
      <PageHeader title="Sell tickets" description="Take the cash. The tickets are emailed to the buyer." />

      {!event.startsAt && (
        <Alert className="mb-5">
          <Info />
          <AlertTitle>Add the date and place</AlertTitle>
          <AlertDescription>
            Guests see them on their tickets.{' '}
            <Link to="/events/$eventId/settings" params={{ eventId: event.id }} className="font-medium underline">
              Edit event
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Form onSubmit={onSubmit} className="gap-5">
        <section>
          <SectionTitle>Buyer</SectionTitle>
          <Card>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="buyer-name">Name</FieldLabel>
                  <Input
                    id="buyer-name"
                    required
                    autoComplete="off"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    placeholder="Jane Doe"
                    value={buyer.buyerName}
                    onChange={update('buyerName')}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="buyer-email">Email</FieldLabel>
                  <Input
                    id="buyer-email"
                    type="email"
                    inputMode="email"
                    required
                    autoComplete="off"
                    autoCapitalize="none"
                    enterKeyHint="next"
                    placeholder="jane@example.com"
                    value={buyer.buyerEmail}
                    onChange={update('buyerEmail')}
                  />
                  <FieldDescription>Their QR tickets are sent here.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="buyer-phone">Phone (optional)</FieldLabel>
                  <Input
                    id="buyer-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    value={buyer.buyerPhone}
                    onChange={update('buyerPhone')}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </section>

        <section>
          <SectionTitle>Tickets</SectionTitle>
          <Card>
            <CardContent>
              <FieldGroup>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="ticket-quantity">Quantity</FieldLabel>
                    <FieldDescription>{formatMoney(event.ticketPrice, event.currency)} each</FieldDescription>
                  </FieldContent>
                  <ButtonGroup>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="One fewer ticket"
                      disabled={quantity <= 1}
                      onClick={() => changeQuantity(quantity - 1)}
                    >
                      <Minus />
                    </Button>
                    <Input
                      id="ticket-quantity"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={50}
                      value={quantity}
                      onChange={(e) => changeQuantity(Number(e.target.value))}
                      className="w-14 [appearance:textfield] px-0 text-center text-base font-semibold tabular-nums [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="One more ticket"
                      disabled={quantity >= 50}
                      onClick={() => changeQuantity(quantity + 1)}
                    >
                      <Plus />
                    </Button>
                  </ButtonGroup>
                </Field>
                <Field data-invalid={amount === null || undefined}>
                  <FieldLabel htmlFor="cash-received">Cash received</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>{currencySymbol(event.currency)}</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="cash-received"
                      inputMode="decimal"
                      aria-invalid={amount === null || undefined}
                      value={amountText}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="tabular-nums"
                    />
                  </InputGroup>
                  {amount === null ? (
                    <FieldError>Enter a number, e.g. 20 or 12.50</FieldError>
                  ) : (
                    amountInput !== null &&
                    amount !== suggested && (
                      <FieldDescription>
                        <button type="button" className="underline" onClick={() => setAmountInput(null)}>
                          Reset to {formatMoney(suggested, event.currency)}
                        </button>
                      </FieldDescription>
                    )
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="sale-notes">Notes (optional)</FieldLabel>
                  <Textarea
                    id="sale-notes"
                    rows={2}
                    placeholder="e.g. paid for her parents too"
                    value={buyer.notes}
                    onChange={update('notes')}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </section>

        <StickyBar aboveTabBar>
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
