import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { errorMessage, type EventInput, type TicketTypeInput } from '#/lib/schemas'
import { Form, SectionTitle, StickyBar } from './common'
import { EventDateTimeField } from './EventDateTimeField'
import { TicketTypesEditor, fromRows, toRows, type TicketTypeRow } from './TicketTypesEditor'

export function EventForm({
  initial,
  initialTypes,
  submitLabel,
  sticky,
  onSubmit,
}: {
  initial: EventInput
  initialTypes?: TicketTypeInput[]
  submitLabel: string
  sticky?: boolean
  onSubmit: (input: EventInput, types: TicketTypeInput[]) => Promise<string | void>
}) {
  const [form, setForm] = useState<EventInput>(initial)
  const [rows, setRows] = useState<TicketTypeRow[]>(() => toRows(initialTypes ?? [], initial.currency))
  const [pending, setPending] = useState(false)

  const field = (key: keyof EventInput) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const currency = form.currency.trim().toUpperCase()
    const types = initialTypes ? fromRows(rows, currency) : []
    if (typeof types === 'string') {
      toast.error(types)
      return
    }
    setPending(true)
    try {
      const message = await onSubmit({ ...form, currency }, types)
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

      {initialTypes && (
        <section>
          <SectionTitle>Tarifs</SectionTitle>
          <Card>
            <CardContent>
              <TicketTypesEditor rows={rows} currency={form.currency.toUpperCase()} onChange={setRows} />
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>Paiement</SectionTitle>
        <Card>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="event-currency">Devise</FieldLabel>
                <Input
                  id="event-currency"
                  required
                  maxLength={3}
                  autoCapitalize="characters"
                  className="w-28 uppercase"
                  {...field('currency')}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="event-bank">Coordonnées bancaires</FieldLabel>
                <Textarea
                  id="event-bank"
                  rows={3}
                  placeholder={'Titulaire : Association du quartier\nIBAN : FR76 …\nBIC : …'}
                  {...field('bankDetails')}
                />
                <FieldDescription>
                  Envoyées aux acheteurs qui paient par virement, avec la référence à indiquer.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionTitle>Pour les invités</SectionTitle>
        <Card>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="event-info">Infos pratiques</FieldLabel>
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
                <FieldDescription>Les réponses des invités aux e-mails arrivent ici.</FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </section>

      {sticky ? <StickyBar>{submitButton}</StickyBar> : submitButton}
    </Form>
  )
}
