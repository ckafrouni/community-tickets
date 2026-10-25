import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '#/components/ui/input-group'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { currencySymbol, inputToMinor, minorToInput } from '#/lib/format'
import { errorMessage, type EventInput } from '#/lib/schemas'
import { Form, SectionTitle, StickyBar } from './common'
import { EventDateTimeField } from './EventDateTimeField'

type FormState = Omit<EventInput, 'ticketPrice'> & { price: string }

export function EventForm({
  initial,
  submitLabel,
  sticky,
  onSubmit,
}: {
  initial: EventInput
  submitLabel: string
  sticky?: boolean
  onSubmit: (input: EventInput) => Promise<string | void>
}) {
  const { ticketPrice, ...rest } = initial
  const [form, setForm] = useState<FormState>({ ...rest, price: minorToInput(ticketPrice, initial.currency) })
  const [pending, setPending] = useState(false)

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const { price, ...input } = form
    const currency = input.currency.trim().toUpperCase()
    const minor = inputToMinor(price, currency)
    if (minor === null) {
      toast.error('Saisissez un prix valide, par exemple 10 ou 12,50.')
      return
    }
    setPending(true)
    try {
      const message = await onSubmit({ ...input, currency, ticketPrice: minor })
      if (message) toast.success(message)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  const submitButton = (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending && <Spinner />} {submitLabel}
    </Button>
  )

  return (
    <Form onSubmit={submit} className="gap-5">
      <section>
        <SectionTitle>Événement</SectionTitle>
        <Card>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="event-name">Nom</FieldLabel>
                <Input
                  id="event-name"
                  required
                  autoCapitalize="words"
                  placeholder="Fête de quartier"
                  {...field('name')}
                />
              </Field>
              <EventDateTimeField value={form.startsAt} onChange={(startsAt) => setForm((f) => ({ ...f, startsAt }))} />
              <Field>
                <FieldLabel htmlFor="event-venue">Lieu</FieldLabel>
                <Input
                  id="event-venue"
                  autoCapitalize="words"
                  placeholder="Salle des fêtes, 12 rue de la Paix"
                  {...field('venue')}
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
              <div className="grid grid-cols-[1fr_6.5rem] gap-3">
                <Field>
                  <FieldLabel htmlFor="event-price">Prix</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>{currencySymbol(form.currency.toUpperCase())}</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput id="event-price" inputMode="decimal" required {...field('price')} />
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="event-currency">Devise</FieldLabel>
                  <Input
                    id="event-currency"
                    required
                    maxLength={3}
                    autoCapitalize="characters"
                    className="uppercase"
                    {...field('currency')}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="event-info">Infos pour les invités</FieldLabel>
                <Textarea id="event-info" rows={3} {...field('info')} />
                <FieldDescription>
                  Sur chaque billet et e-mail : ouverture des portes, parking, quoi apporter.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="event-contact">E-mail de contact</FieldLabel>
                <Input
                  id="event-contact"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  {...field('contactEmail')}
                />
                <FieldDescription>Les réponses des invités aux e-mails de billets arrivent ici.</FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </section>

      {sticky ? <StickyBar>{submitButton}</StickyBar> : submitButton}
    </Form>
  )
}
