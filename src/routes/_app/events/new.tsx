import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AppHeader, Main } from '#/components/AppHeader'
import { PageHeader } from '#/components/common'
import { EventForm } from '#/components/EventForm'
import { createEventFn } from '#/functions/events.functions'
import { NEW_EVENT } from '#/lib/schemas'

export const Route = createFileRoute('/_app/events/new')({
  head: () => ({ meta: [{ title: 'New event · Community Tickets' }] }),
  component: NewEventPage,
})

function NewEventPage() {
  const navigate = useNavigate()
  return (
    <>
      <AppHeader back title="New event" />
      <Main>
        <PageHeader title="Create an event" />
        <EventForm
          initial={NEW_EVENT}
          submitLabel="Create event"
          sticky
          onSubmit={async (input) => {
            const { eventId } = await createEventFn({ data: input })
            await navigate({ to: '/events/$eventId', params: { eventId } })
          }}
        />
      </Main>
    </>
  )
}
