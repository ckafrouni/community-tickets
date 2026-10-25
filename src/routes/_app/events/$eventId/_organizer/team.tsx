import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Send, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Form, PageHeader, PersonAvatar, SectionTitle } from '#/components/common'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import { Badge } from '#/components/ui/badge'
import { Button, buttonVariants } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '#/components/ui/item'
import { Spinner } from '#/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { addMemberFn, listMembersFn, removeMemberFn, resendInviteFn } from '#/functions/team.functions'
import { ROLE_LABELS } from '#/lib/roles'
import { errorMessage } from '#/lib/schemas'
import type { EventMember, EventRole } from '#/lib/types'

export const Route = createFileRoute('/_app/events/$eventId/_organizer/team')({
  loader: ({ params }) => listMembersFn({ data: { eventId: params.eventId } }),
  head: () => ({ meta: [{ title: 'Team' }] }),
  component: TeamPage,
})

function TeamPage() {
  const { members, currentUserId } = Route.useLoaderData()
  const { eventId } = Route.useParams()

  return (
    <>
      <Link
        to="/events/$eventId/settings"
        params={{ eventId }}
        className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2 mb-2 text-muted-foreground' })}
      >
        <ChevronLeft data-icon="inline-start" /> Settings
      </Link>
      <PageHeader title="Team" description="Organizers run the event. Volunteers can only check guests in." />

      <ItemGroup className="mb-6 gap-2">
        {members.map((member) => (
          <MemberItem key={member.userId} member={member} eventId={eventId} isYou={member.userId === currentUserId} />
        ))}
      </ItemGroup>

      <InviteCard eventId={eventId} />
    </>
  )
}

function MemberItem({ member, eventId, isYou }: { member: EventMember; eventId: string; isYou: boolean }) {
  const router = useRouter()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<unknown>, success: string, after?: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
      toast.success(success)
      await (after ? after() : router.invalidate())
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Item variant="outline" size="sm" className="bg-card">
      <ItemMedia>
        <PersonAvatar name={member.name} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full truncate">
          {member.name}
          {isYou && <span className="font-normal text-muted-foreground"> (you)</span>}
        </ItemTitle>
        <ItemDescription className="truncate">{member.email}</ItemDescription>
      </ItemContent>
      <ItemActions className="gap-1">
        <Badge variant={member.role === 'organizer' ? 'default' : 'secondary'}>{ROLE_LABELS[member.role]}</Badge>
        {!isYou && (
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label={`Send ${member.name} a sign-in link`}
            onClick={() =>
              run(
                () => resendInviteFn({ data: { eventId, userId: member.userId } }),
                `Sent a sign-in link to ${member.email}.`,
              )
            }
          >
            <Send />
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-label={isYou ? 'Leave this event' : `Remove ${member.name}`}
              />
            }
          >
            <UserMinus />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{isYou ? 'Leave this event?' : `Remove ${member.name}?`}</AlertDialogTitle>
              <AlertDialogDescription>
                {isYou ? 'You will lose access to this event.' : 'They will lose access to this event right away.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  run(
                    () => removeMemberFn({ data: { eventId, userId: member.userId } }),
                    isYou ? 'You left the event.' : `Removed ${member.name}.`,
                    isYou ? () => navigate({ to: '/events' }) : undefined,
                  )
                }
              >
                {busy && <Spinner />} {isYou ? 'Leave' : 'Remove'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ItemActions>
    </Item>
  )
}

function InviteCard({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [form, setForm] = useState<{ name: string; email: string; role: EventRole }>({
    name: '',
    email: '',
    role: 'volunteer',
  })
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      const { invited } = await addMemberFn({ data: { eventId, ...form } })
      toast.success(
        invited
          ? `Invited ${form.email}. They'll get an email to choose a password.`
          : `Added ${form.email}. They'll see this event when they sign in.`,
      )
      setForm({ name: '', email: '', role: 'volunteer' })
      await router.invalidate()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <SectionTitle>Invite someone</SectionTitle>
      <Card>
        <CardContent>
          <Form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="invite-name">Name</FieldLabel>
                <Input
                  id="invite-name"
                  required
                  autoCapitalize="words"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                <Input
                  id="invite-email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel>Role</FieldLabel>
                <ToggleGroup
                  aria-label="Role"
                  variant="outline"
                  spacing={0}
                  value={[form.role]}
                  onValueChange={(value) => value[0] && setForm((f) => ({ ...f, role: value[0] as EventRole }))}
                >
                  <ToggleGroupItem value="volunteer">Volunteer</ToggleGroupItem>
                  <ToggleGroupItem value="organizer">Organizer</ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>
                  {form.role === 'volunteer'
                    ? 'Can scan tickets and check guests in. Nothing else.'
                    : 'Can sell tickets, see and edit guests, edit the event and manage the team.'}
                </FieldDescription>
              </Field>
              <Button type="submit" size="lg" disabled={pending}>
                {pending && <Spinner />} Send invite
              </Button>
            </FieldGroup>
          </Form>
        </CardContent>
      </Card>
    </section>
  )
}
