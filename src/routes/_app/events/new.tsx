import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AppHeader, Main } from '#/components/AppHeader'
import { PageHeader } from '#/components/common'
import { EventForm } from '#/components/EventForm'
import { createEventFn } from '#/functions/events.functions'
import { NEW_EVENT, NEW_TICKET_TYPES } from '#/lib/schemas'

export const Route = createFileRoute('/_app/events/new')({
  head: () => ({ meta: [{ title: 'Nouvel événement · Community Tickets' }] }),
  component: NewEventPage,
})

function NewEventPage() {
  const navigate = useNavigate()
  return (
    <>
      <AppHeader back title="Nouvel événement" />
      <Main>
        <PageHeader title="Créer un événement" />
        <EventForm
          initial={NEW_EVENT}
          initialTypes={NEW_TICKET_TYPES}
          submitLabel="Créer l’événement"
          sticky
          onSubmit={async (input, ticketTypes) => {
            const { eventId } = await createEventFn({ data: { ...input, ticketTypes } })
            await navigate({ to: '/events/$eventId', params: { eventId } })
          }}
        />
      </Main>
    </>
  )
}
