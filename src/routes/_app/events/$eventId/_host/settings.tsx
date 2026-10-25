import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { ChevronRight, Download, Mail, Users } from 'lucide-react'
import { useState } from 'react'
import { EventForm } from '#/components/EventForm'
import {
  Alert,
  Button,
  Field,
  Input,
  List,
  PageHeader,
  SectionTitle,
  Sheet,
  Spinner,
  interactiveRowClass,
} from '#/components/ui'
import { eventEmailInfoFn, sendTestEmailFn, updateEventFn } from '#/functions/events.functions'
import { errorMessage } from '#/lib/schemas'

export const Route = createFileRoute('/_app/events/$eventId/_host/settings')({
  loader: ({ params }) => eventEmailInfoFn({ data: { eventId: params.eventId } }),
  head: () => ({ meta: [{ title: 'Settings' }] }),
  component: SettingsPage,
})

function SettingsPage() {
  const { event } = Route.useRouteContext()
  const { emailFrom } = Route.useLoaderData()
  const router = useRouter()
  const { id, ...details } = event

  return (
    <>
      <PageHeader title="Settings" />

      <section className="mb-6">
        <SectionTitle>Manage</SectionTitle>
        <List>
          <li>
            <Link to="/events/$eventId/team" params={{ eventId: id }} className={interactiveRowClass}>
              <RowIcon>
                <Users />
              </RowIcon>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Team</span>
                <span className="block text-sm text-zinc-500">Hosts and door staff</span>
              </span>
              <ChevronRight className="size-5 text-zinc-300" />
            </Link>
          </li>
          <li>
            <a href={`/api/events/${id}/guests.csv`} className={interactiveRowClass}>
              <RowIcon>
                <Download />
              </RowIcon>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Export guest list</span>
                <span className="block text-sm text-zinc-500">CSV for any spreadsheet app</span>
              </span>
            </a>
          </li>
          <li>
            <button type="button" popoverTarget="test-email" className={`${interactiveRowClass} w-full text-left`}>
              <RowIcon>
                <Mail />
              </RowIcon>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Send a test email</span>
                <span className="block truncate text-sm text-zinc-500">Tickets come from {emailFrom}</span>
              </span>
              <ChevronRight className="size-5 text-zinc-300" />
            </button>
          </li>
        </List>
      </section>

      <EventForm
        initial={details}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await updateEventFn({ data: { eventId: id, ...input } })
          await router.invalidate()
          return 'Saved.'
        }}
      />

      <TestEmailSheet eventId={id} />
    </>
  )
}

function RowIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 [&>svg]:size-5">
      {children}
    </span>
  )
}

function TestEmailSheet({ eventId }: { eventId: string }) {
  const [to, setTo] = useState('')
  const [status, setStatus] = useState<{ tone: 'green' | 'red'; text: string }>()
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setStatus(undefined)
    try {
      await sendTestEmailFn({ data: { eventId, to } })
      setStatus({ tone: 'green', text: `Sent to ${to}. Check the inbox and the spam folder.` })
    } catch (err) {
      setStatus({ tone: 'red', text: errorMessage(err) })
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet id="test-email" title="Send a test email">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Send to">
          <Input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            required
            placeholder="you@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        {status && <Alert tone={status.tone}>{status.text}</Alert>}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Spinner />} Send test
        </Button>
      </form>
    </Sheet>
  )
}
