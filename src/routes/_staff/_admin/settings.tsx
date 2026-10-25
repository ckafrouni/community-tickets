import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Spinner, Textarea } from '#/components/ui'
import { getSettingsFn, saveSettingsFn, sendTestEmailFn } from '#/functions/settings.functions'
import { inputToMinor, minorToInput } from '#/lib/format'
import { errorMessage } from '#/lib/schemas'

export const Route = createFileRoute('/_staff/_admin/settings')({
  loader: () => getSettingsFn(),
  head: () => ({ meta: [{ title: 'Settings' }] }),
  component: SettingsPage,
})

function SettingsPage() {
  const data = Route.useLoaderData()
  return (
    <>
      <PageHeader title="Settings" description="Event details appear on tickets, emails and receipts." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <EventForm />
        <div className="space-y-4">
          <EmailCard />
          <Card className="space-y-2 text-sm">
            <h2 className="font-semibold">Door staff</h2>
            <p className="text-slate-600">
              Give volunteers their own scan-only accounts on the{' '}
              <Link to="/staff" className="font-semibold text-indigo-600 hover:underline">
                Staff
              </Link>{' '}
              page.
            </p>
          </Card>
          <Card className="space-y-2 text-sm">
            <h2 className="font-semibold">Ticket links</h2>
            <p className="break-all text-slate-600">
              Links in emails point to <code className="font-mono">{data.baseUrl}</code>
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}

function EventForm() {
  const { settings } = Route.useLoaderData()
  const router = useRouter()
  const [form, setForm] = useState({ ...settings, price: minorToInput(settings.ticketPrice, settings.currency) })
  const [status, setStatus] = useState<{ tone: 'green' | 'red'; text: string }>()
  const [pending, setPending] = useState(false)

  const field = (
    key: 'eventName' | 'eventDate' | 'eventVenue' | 'eventInfo' | 'currency' | 'contactEmail' | 'price',
  ) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const currency = form.currency.trim().toUpperCase()
    const ticketPrice = inputToMinor(form.price, currency)
    if (ticketPrice === null) {
      setStatus({ tone: 'red', text: 'Enter a valid ticket price.' })
      return
    }
    setPending(true)
    setStatus(undefined)
    try {
      const { price: _price, ...rest } = form
      await saveSettingsFn({ data: { ...rest, currency, ticketPrice } })
      await router.invalidate()
      setStatus({ tone: 'green', text: 'Settings saved.' })
    } catch (e) {
      setStatus({ tone: 'red', text: errorMessage(e) })
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4">
        <h2 className="font-semibold">Event</h2>
        <Field label="Event name">
          <Input required {...field('eventName')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date & time" hint="Shown exactly as typed.">
            <Input {...field('eventDate')} placeholder="Saturday, Nov 14 · 6:00 PM" />
          </Field>
          <Field label="Venue">
            <Input {...field('eventVenue')} placeholder="Community Hall, 12 Main St" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ticket price" hint="Pre-fills the sale form; you can change it per sale.">
            <Input inputMode="decimal" required {...field('price')} />
          </Field>
          <Field label="Currency" hint="3-letter code, e.g. USD, EUR, GBP, CAD.">
            <Input required maxLength={3} className="uppercase" {...field('currency')} />
          </Field>
        </div>
        <Field label="Contact email (optional)" hint="Buyers' replies go here.">
          <Input type="email" autoCapitalize="none" {...field('contactEmail')} />
        </Field>
        <Field label="Extra info for tickets (optional)" hint="e.g. doors open time, parking, what to bring.">
          <Textarea rows={4} {...field('eventInfo')} />
        </Field>
        {status && <Alert tone={status.tone}>{status.text}</Alert>}
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />} Save settings
        </Button>
      </form>
    </Card>
  )
}

function EmailCard() {
  const { emailFrom } = Route.useLoaderData()
  const [to, setTo] = useState('')
  const [status, setStatus] = useState<{ tone: 'green' | 'red' | 'amber'; text: string }>()
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setStatus(undefined)
    try {
      await sendTestEmailFn({ data: { to } })
      setStatus({ tone: 'green', text: `Test email sent to ${to}. Check the inbox (and spam folder).` })
    } catch (e) {
      setStatus({ tone: 'red', text: errorMessage(e) })
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Email delivery</h2>
        <Badge tone="indigo">Cloudflare Email</Badge>
      </div>
      <p className="text-slate-600">
        Tickets are sent from <code className="font-mono">{emailFrom}</code>. Send yourself a test to check delivery.
      </p>
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          type="email"
          required
          placeholder="you@example.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Test email address"
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending && <Spinner />} Test
        </Button>
      </form>
      {status && <Alert tone={status.tone}>{status.text}</Alert>}
    </Card>
  )
}
