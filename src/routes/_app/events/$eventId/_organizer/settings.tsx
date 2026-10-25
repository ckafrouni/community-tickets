import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { ChevronRight, Download, Mail, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader, SectionTitle } from '#/components/common'
import { EventForm } from '#/components/EventForm'
import { Button } from '#/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '#/components/ui/drawer'
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '#/components/ui/item'
import { Spinner } from '#/components/ui/spinner'
import { eventEmailInfoFn, sendTestEmailFn, updateEventFn } from '#/functions/events.functions'
import { errorMessage } from '#/lib/schemas'

export const Route = createFileRoute('/_app/events/$eventId/_organizer/settings')({
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
        <ItemGroup className="gap-2">
          <Item
            variant="outline"
            className="bg-card"
            render={<Link to="/events/$eventId/team" params={{ eventId: id }} />}
          >
            <ItemMedia variant="icon">
              <Users />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Team</ItemTitle>
              <ItemDescription>Organizers and volunteers</ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronRight className="size-4 text-muted-foreground" />
            </ItemActions>
          </Item>
          <Item variant="outline" className="bg-card" render={<a href={`/api/events/${id}/guests.csv`} />}>
            <ItemMedia variant="icon">
              <Download />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Export guest list</ItemTitle>
              <ItemDescription>CSV for any spreadsheet app</ItemDescription>
            </ItemContent>
          </Item>
          <TestEmail eventId={id} emailFrom={emailFrom} />
        </ItemGroup>
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
    </>
  )
}

function TestEmail({ eventId, emailFrom }: { eventId: string; emailFrom: string }) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      await sendTestEmailFn({ data: { eventId, to } })
      setOpen(false)
      toast.success(`Sent to ${to}. Check the inbox and the spam folder.`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Item variant="outline" className="bg-card">
        <ItemMedia variant="icon">
          <Mail />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle>Test email</ItemTitle>
          <ItemDescription className="truncate">Tickets come from {emailFrom}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <DrawerTrigger render={<Button variant="secondary" size="sm" />}>Send</DrawerTrigger>
        </ItemActions>
      </Item>
      <DrawerContent>
        <form onSubmit={onSubmit} className="flex flex-col">
          <DrawerHeader>
            <DrawerTitle>Send a test email</DrawerTitle>
            <DrawerDescription>Check that tickets reach real inboxes.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <Field>
              <FieldLabel htmlFor="test-email-to">Send to</FieldLabel>
              <Input
                id="test-email-to"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                required
                placeholder="you@example.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button type="submit" size="lg" disabled={pending}>
              {pending && <Spinner />} Send test
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
