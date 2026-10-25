import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Send, UserMinus } from 'lucide-react'
import { useState } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Form,
  Input,
  List,
  PageHeader,
  SectionTitle,
  Segmented,
  Spinner,
  backLinkClass,
  rowClass,
} from '#/components/ui'
import { addMemberFn, listMembersFn, removeMemberFn, resendInviteFn } from '#/functions/team.functions'
import { errorMessage } from '#/lib/schemas'
import type { EventMember, EventRole } from '#/lib/types'

export const Route = createFileRoute('/_app/events/$eventId/_host/team')({
  loader: ({ params }) => listMembersFn({ data: { eventId: params.eventId } }),
  head: () => ({ meta: [{ title: 'Team' }] }),
  component: TeamPage,
})

type Message = { tone: 'green' | 'red'; text: string }

function TeamPage() {
  const { members, currentUserId } = Route.useLoaderData()
  const { eventId } = Route.useParams()
  const router = useRouter()
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<Message>()

  async function run(id: string, fn: () => Promise<unknown>, success: string) {
    setBusyId(id)
    setMessage(undefined)
    try {
      await fn()
      setMessage({ tone: 'green', text: success })
      if (id === `remove:${currentUserId}`) await navigate({ to: '/events' })
      else await router.invalidate()
    } catch (e) {
      setMessage({ tone: 'red', text: errorMessage(e) })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <Link to="/events/$eventId/settings" params={{ eventId }} className={backLinkClass}>
        <ChevronLeft className="size-5" /> Settings
      </Link>
      <PageHeader title="Team" description="Hosts can do everything. Door staff can only check guests in." />

      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <List className="mb-6">
        {members.map((member) => (
          <MemberRow
            key={member.userId}
            member={member}
            isYou={member.userId === currentUserId}
            busy={busyId !== null}
            onResend={() =>
              run(
                `invite:${member.userId}`,
                () => resendInviteFn({ data: { eventId, userId: member.userId } }),
                `Sent a sign-in link to ${member.email}.`,
              )
            }
            onRemove={() => {
              const self = member.userId === currentUserId
              if (!confirm(self ? 'Leave this event? You will lose access.' : `Remove ${member.name} from the team?`))
                return
              void run(
                `remove:${member.userId}`,
                () => removeMemberFn({ data: { eventId, userId: member.userId } }),
                `Removed ${member.name}.`,
              )
            }}
          />
        ))}
      </List>

      <InviteCard eventId={eventId} onDone={(text) => setMessage({ tone: 'green', text })} />
    </>
  )
}

function MemberRow({
  member,
  isYou,
  busy,
  onResend,
  onRemove,
}: {
  member: EventMember
  isYou: boolean
  busy: boolean
  onResend: () => void
  onRemove: () => void
}) {
  return (
    <li className={rowClass}>
      <Avatar name={member.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {member.name}
          {isYou && <span className="font-normal text-zinc-400"> (you)</span>}
        </span>
        <span className="block truncate text-sm text-zinc-500">{member.email}</span>
      </span>
      <Badge tone={member.role === 'host' ? 'dark' : 'neutral'}>{member.role === 'host' ? 'Host' : 'Door'}</Badge>
      {!isYou && (
        <Button
          variant="ghost"
          size="icon"
          disabled={busy}
          onClick={onResend}
          aria-label={`Send ${member.name} a sign-in link`}
        >
          <Send className="size-5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        disabled={busy}
        onClick={onRemove}
        aria-label={isYou ? 'Leave this event' : `Remove ${member.name}`}
        className="hover:!text-red-600"
      >
        <UserMinus className="size-5" />
      </Button>
    </li>
  )
}

function InviteCard({ eventId, onDone }: { eventId: string; onDone: (text: string) => void }) {
  const router = useRouter()
  const [form, setForm] = useState<{ name: string; email: string; role: EventRole }>({
    name: '',
    email: '',
    role: 'door',
  })
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(undefined)
    try {
      const { invited } = await addMemberFn({ data: { eventId, ...form } })
      onDone(
        invited
          ? `Invited ${form.email}. They'll get an email to choose a password.`
          : `Added ${form.email}. They'll see this event when they sign in.`,
      )
      setForm({ name: '', email: '', role: 'door' })
      await router.invalidate()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <SectionTitle>Invite someone</SectionTitle>
      <Card>
        <Form onSubmit={onSubmit} className="space-y-4">
          <Field label="Name">
            <Input
              required
              autoCapitalize="words"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium text-zinc-600">Role</p>
            <Segmented
              label="Role"
              value={form.role}
              onChange={(role) => setForm((f) => ({ ...f, role }))}
              options={[
                { value: 'door', label: 'Door staff' },
                { value: 'host', label: 'Host' },
              ]}
            />
            <p className="mt-1.5 text-[13px] text-zinc-500">
              {form.role === 'door'
                ? 'Can scan tickets and check guests in.'
                : 'Can sell tickets, see guests, edit the event and manage the team.'}
            </p>
          </div>
          {error && <Alert tone="red">{error}</Alert>}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending && <Spinner />} Send invite
          </Button>
        </Form>
      </Card>
    </section>
  )
}
