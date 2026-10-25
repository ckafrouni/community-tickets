import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AppHeader, Main } from '#/components/AppHeader'
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
        <h1 className="mb-5 text-[28px] leading-tight font-bold tracking-tight">Create an event</h1>
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
