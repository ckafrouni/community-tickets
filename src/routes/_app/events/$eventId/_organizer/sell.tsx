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
  head: () => ({ meta: [{ title: 'Vendre des billets' }] }),
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
      <PageHeader
        title="Vendre des billets"
        description="Encaissez, puis les billets partent par e-mail à l’acheteur."
      />

      {!event.startsAt && (
        <Alert className="mb-5">
          <Info />
          <AlertTitle>Ajoutez la date et le lieu</AlertTitle>
          <AlertDescription>
            Les invités les voient sur leurs billets.{' '}
            <Link to="/events/$eventId/settings" params={{ eventId: event.id }} className="font-medium underline">
              Modifier l’événement
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Form onSubmit={onSubmit} className="gap-5">
        <section>
          <SectionTitle>Acheteur</SectionTitle>
          <Card>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="buyer-name">Nom</FieldLabel>
                  <Input
                    id="buyer-name"
                    required
                    autoComplete="off"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    placeholder="Marie Dupont"
                    value={buyer.buyerName}
                    onChange={update('buyerName')}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="buyer-email">E-mail</FieldLabel>
                  <Input
                    id="buyer-email"
                    type="email"
                    inputMode="email"
                    required
                    autoComplete="off"
                    autoCapitalize="none"
                    enterKeyHint="next"
                    placeholder="marie@exemple.fr"
                    value={buyer.buyerEmail}
                    onChange={update('buyerEmail')}
                  />
                  <FieldDescription>Les billets avec QR code sont envoyés ici.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="buyer-phone">Téléphone (facultatif)</FieldLabel>
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
          <SectionTitle>Billets</SectionTitle>
          <Card>
            <CardContent>
              <FieldGroup>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="ticket-quantity">Quantité</FieldLabel>
                    <FieldDescription>{formatMoney(event.ticketPrice, event.currency)} l’unité</FieldDescription>
                  </FieldContent>
                  <ButtonGroup>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Un billet de moins"
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
                      aria-label="Un billet de plus"
                      disabled={quantity >= 50}
                      onClick={() => changeQuantity(quantity + 1)}
                    >
                      <Plus />
                    </Button>
                  </ButtonGroup>
                </Field>
                <Field data-invalid={amount === null || undefined}>
                  <FieldLabel htmlFor="cash-received">Espèces reçues</FieldLabel>
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
                    <FieldError>Saisissez un nombre, par exemple 20 ou 12,50</FieldError>
                  ) : (
                    amountInput !== null &&
                    amount !== suggested && (
                      <FieldDescription>
                        <button type="button" className="underline" onClick={() => setAmountInput(null)}>
                          Revenir à {formatMoney(suggested, event.currency)}
                        </button>
                      </FieldDescription>
                    )
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="sale-notes">Notes (facultatif)</FieldLabel>
                  <Textarea
                    id="sale-notes"
                    rows={2}
                    placeholder="ex. a aussi payé pour ses parents"
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
              ? 'Saisissez le montant reçu'
              : `Valider ${formatMoney(amount, event.currency)} · ${plural(quantity, 'billet')}`}
          </Button>
        </StickyBar>
      </Form>
    </>
  )
}
