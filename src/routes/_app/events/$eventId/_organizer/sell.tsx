import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Info, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Form, PageHeader, SectionTitle, StickyBar } from '#/components/common'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { ButtonGroup, ButtonGroupText } from '#/components/ui/button-group'
import { Card, CardContent } from '#/components/ui/card'
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '#/components/ui/input-group'
import { Separator } from '#/components/ui/separator'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { listTicketTypesFn } from '#/functions/events.functions'
import { createSaleFn } from '#/functions/orders.functions'
import { currencySymbol, formatMoney, inputToMinor, minorToInput, plural } from '#/lib/format'
import { errorMessage } from '#/lib/schemas'
import type { PaymentMethod } from '#/lib/types'

export const Route = createFileRoute('/_app/events/$eventId/_organizer/sell')({
  loader: ({ params }) => listTicketTypesFn({ data: { eventId: params.eventId } }),
  head: () => ({ meta: [{ title: 'Vendre des billets' }] }),
  component: SellPage,
})

const EMPTY_BUYER = { buyerName: '', buyerEmail: '', buyerPhone: '', notes: '' }
const MAX_TICKETS = 50

function SellPage() {
  const { event } = Route.useRouteContext()
  const types = Route.useLoaderData()
  const navigate = useNavigate()
  const [buyer, setBuyer] = useState(EMPTY_BUYER)
  const [counts, setCounts] = useState<Record<number, number>>(() => (types.length === 1 ? { [types[0].id]: 1 } : {}))
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [cashInput, setCashInput] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const money = (amount: number) => formatMoney(amount, event.currency)
  const quantity = types.reduce((sum, type) => sum + (counts[type.id] ?? 0), 0)
  const total = types.reduce((sum, type) => sum + (counts[type.id] ?? 0) * type.price, 0)
  const cashText = cashInput ?? minorToInput(total, event.currency)
  const cash = method === 'cash' ? inputToMinor(cashText, event.currency) : 0
  const remaining = cash === null ? total : Math.max(total - cash, 0)
  const paidNow = cash !== null && cash >= total

  function update(field: keyof typeof EMPTY_BUYER) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setBuyer((b) => ({ ...b, [field]: e.target.value }))
  }

  function setCount(typeId: number, next: number) {
    const others = quantity - (counts[typeId] ?? 0)
    setCounts((c) => ({ ...c, [typeId]: Math.max(0, Math.min(next, MAX_TICKETS - others)) }))
    setCashInput(null)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (cash === null || quantity === 0) return
    setPending(true)
    try {
      const { orderId } = await createSaleFn({
        data: {
          eventId: event.id,
          ...buyer,
          items: types.map((type) => ({ ticketTypeId: type.id, quantity: counts[type.id] ?? 0 })),
          received: cash,
          method,
        },
      })
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

  const submitLabel =
    quantity === 0
      ? 'Choisissez des billets'
      : cash === null
        ? 'Saisissez le montant reçu'
        : total === 0
          ? `Valider · ${plural(quantity, 'billet gratuit', 'billets gratuits')}`
          : paidNow
            ? `Valider ${money(cash)} · ${plural(quantity, 'billet')}`
            : `Valider · reste ${money(remaining)} par virement`

  return (
    <>
      <PageHeader title="Vendre des billets" description="Choisissez les billets, encaissez, et c’est envoyé." />

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
              <FieldGroup className="gap-4">
                {types.map((type) => {
                  const count = counts[type.id] ?? 0
                  return (
                    <Field key={type.id} orientation="horizontal">
                      <FieldContent>
                        <FieldLabel>{type.name}</FieldLabel>
                        <FieldDescription>{type.price === 0 ? 'Gratuit' : money(type.price)}</FieldDescription>
                      </FieldContent>
                      <ButtonGroup aria-label={`Nombre de billets ${type.name}`}>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={`Un billet ${type.name} de moins`}
                          disabled={count === 0}
                          onClick={() => setCount(type.id, count - 1)}
                        >
                          <Minus />
                        </Button>
                        <ButtonGroupText className="w-12 justify-center text-base font-semibold tabular-nums">
                          {count}
                        </ButtonGroupText>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={`Un billet ${type.name} de plus`}
                          disabled={quantity >= MAX_TICKETS}
                          onClick={() => setCount(type.id, count + 1)}
                        >
                          <Plus />
                        </Button>
                      </ButtonGroup>
                    </Field>
                  )
                })}
                <Separator />
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-medium">Total · {plural(quantity, 'billet')}</span>
                  <span className="text-xl font-semibold tabular-nums">{money(total)}</span>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </section>

        {total > 0 && (
          <section>
            <SectionTitle>Paiement</SectionTitle>
            <Card>
              <CardContent>
                <FieldGroup>
                  <ToggleGroup
                    aria-label="Mode de paiement"
                    variant="outline"
                    spacing={0}
                    value={[method]}
                    onValueChange={(value) => value[0] && setMethod(value[0] as PaymentMethod)}
                  >
                    <ToggleGroupItem value="cash">Espèces</ToggleGroupItem>
                    <ToggleGroupItem value="transfer">Virement plus tard</ToggleGroupItem>
                  </ToggleGroup>
                  {method === 'cash' && (
                    <Field data-invalid={cash === null || undefined}>
                      <FieldLabel htmlFor="cash-received">Espèces reçues</FieldLabel>
                      <InputGroup>
                        <InputGroupAddon>
                          <InputGroupText>{currencySymbol(event.currency)}</InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                          id="cash-received"
                          inputMode="decimal"
                          aria-invalid={cash === null || undefined}
                          value={cashText}
                          onChange={(e) => setCashInput(e.target.value)}
                          className="tabular-nums"
                        />
                      </InputGroup>
                      {cash === null && <FieldError>Saisissez un nombre, par exemple 20 ou 12,50</FieldError>}
                    </Field>
                  )}
                  <FieldDescription>
                    {paidNow
                      ? 'Payé : les billets partent tout de suite par e-mail.'
                      : `L’acheteur reçoit une demande de virement de ${money(remaining)} avec une référence. Les billets partent dès que vous enregistrez le paiement.`}
                  </FieldDescription>
                  {!paidNow && !event.bankDetails && (
                    <Alert>
                      <Info />
                      <AlertDescription>
                        Ajoutez vos coordonnées bancaires dans{' '}
                        <Link
                          to="/events/$eventId/settings"
                          params={{ eventId: event.id }}
                          className="font-medium underline"
                        >
                          Réglages
                        </Link>{' '}
                        pour qu’elles figurent dans l’e-mail.
                      </AlertDescription>
                    </Alert>
                  )}
                </FieldGroup>
              </CardContent>
            </Card>
          </section>
        )}

        <section>
          <SectionTitle>Notes</SectionTitle>
          <Card>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="sale-notes" className="sr-only">
                  Notes
                </FieldLabel>
                <Textarea
                  id="sale-notes"
                  rows={2}
                  placeholder="Facultatif, ex. a aussi payé pour ses parents"
                  value={buyer.notes}
                  onChange={update('notes')}
                />
              </Field>
            </CardContent>
          </Card>
        </section>

        <StickyBar aboveTabBar>
          <Button type="submit" size="lg" className="w-full" disabled={pending || cash === null || quantity === 0}>
            {pending && <Spinner />}
            {submitLabel}
          </Button>
        </StickyBar>
      </Form>
    </>
  )
}
