import { useState } from 'react'
import { inputToMinor, minorToInput } from '#/lib/format'
import { errorMessage, type EventInput } from '#/lib/schemas'
import { Alert, Button, Card, Field, Form, Input, SectionTitle, Spinner, StickyBar, Textarea } from './ui'

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
  const [status, setStatus] = useState<{ tone: 'green' | 'red'; text: string }>()
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
      setStatus({ tone: 'red', text: 'Enter a valid ticket price, e.g. 10 or 12.50.' })
      return
    }
    setPending(true)
    setStatus(undefined)
    try {
      const message = await onSubmit({ ...input, currency, ticketPrice: minor })
      if (message) setStatus({ tone: 'green', text: message })
    } catch (e) {
      setStatus({ tone: 'red', text: errorMessage(e) })
    } finally {
      setPending(false)
    }
  }

  const actions = (
    <>
      {status && <Alert tone={status.tone}>{status.text}</Alert>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Spinner />} {submitLabel}
      </Button>
    </>
  )

  return (
    <Form onSubmit={submit} className="space-y-5">
      <section>
        <SectionTitle>Event</SectionTitle>
        <Card className="space-y-4">
          <Field label="Name">
            <Input required autoCapitalize="words" placeholder="Summer Community Fair" {...field('name')} />
          </Field>
          <Field label="Date & time">
            <Input type="datetime-local" {...field('startsAt')} />
          </Field>
          <Field label="Location">
            <Input autoCapitalize="words" placeholder="Community Hall, 12 Main St" {...field('venue')} />
          </Field>
        </Card>
      </section>

      <section>
        <SectionTitle>Tickets</SectionTitle>
        <Card className="space-y-4">
          <div className="grid grid-cols-[1fr_6.5rem] gap-3">
            <Field label="Price">
              <Input inputMode="decimal" required {...field('price')} />
            </Field>
            <Field label="Currency">
              <Input required maxLength={3} autoCapitalize="characters" className="uppercase" {...field('currency')} />
            </Field>
          </div>
          <Field label="Details for guests" hint="On every ticket and email: doors, parking, what to bring.">
            <Textarea rows={3} {...field('info')} />
          </Field>
          <Field label="Contact email" hint="Guests' replies to ticket emails go here.">
            <Input type="email" inputMode="email" autoCapitalize="none" {...field('contactEmail')} />
          </Field>
        </Card>
      </section>

      {sticky ? <StickyBar>{actions}</StickyBar> : <div className="space-y-3">{actions}</div>}
    </Form>
  )
}
