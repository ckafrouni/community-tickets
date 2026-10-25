import { Link, createFileRoute } from '@tanstack/react-router'
import { CalendarPlus, MapPin, Plus } from 'lucide-react'
import { useState } from 'react'
import { AppHeader, Main } from '#/components/AppHeader'
import { Badge, EmptyState, EventCover, Segmented, buttonClass } from '#/components/ui'
import { listEventsFn } from '#/functions/events.functions'
import { parseEventDate } from '#/lib/format'
import type { EventListItem } from '#/lib/types'

export const Route = createFileRoute('/_app/events/')({
  loader: () => listEventsFn(),
  head: () => ({ meta: [{ title: 'Events · Community Tickets' }] }),
  component: EventsPage,
})

type Tab = 'upcoming' | 'past'

function groupByDay(events: EventListItem[]) {
  const groups: { key: string; label: string; events: EventListItem[] }[] = []
  for (const event of events) {
    const when = parseEventDate(event.startsAt)
    const key = when ? event.startsAt.slice(0, 10) : 'tbd'
    let group = groups.find((g) => g.key === key)
    if (!group) {
      group = { key, label: when ? when.date : 'Date to be announced', events: [] }
      groups.push(group)
    }
    group.events.push(event)
  }
  return groups
}

function EventsPage() {
  const { events, today } = Route.useLoaderData()
  const [tab, setTab] = useState<Tab>('upcoming')
  const isPast = (e: EventListItem) => parseEventDate(e.startsAt) !== null && e.startsAt.slice(0, 10) < today
  const upcoming = events.filter((e) => !isPast(e))
  const past = events.filter(isPast).reverse()
  const shown = tab === 'upcoming' ? upcoming : past

  return (
    <>
      <AppHeader title="Community Tickets" />
      <Main>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Events</h1>
          <Link to="/events/new" className={buttonClass('primary', 'sm')}>
            <Plus className="size-4" strokeWidth={2.5} /> Create
          </Link>
        </div>

        {events.length > 0 && (
          <div className="mb-5">
            <Segmented
              label="Show"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'past', label: 'Past' },
              ]}
            />
          </div>
        )}

        {shown.length === 0 ? (
          <EmptyState
            icon={<CalendarPlus />}
            title={
              events.length === 0
                ? 'Create your first event'
                : tab === 'upcoming'
                  ? 'No upcoming events'
                  : 'No past events'
            }
          >
            {events.length === 0 && (
              <>
                <p>Sell tickets for cash, email QR codes and check guests in at the door.</p>
                <Link to="/events/new" className={buttonClass('primary', 'md', 'mt-4')}>
                  Create event
                </Link>
              </>
            )}
          </EmptyState>
        ) : (
          <div className="space-y-6">
            {groupByDay(shown).map((group) => (
              <section key={group.key}>
                <h2 className="mb-2 flex items-center gap-2 px-1 text-[15px] font-semibold text-zinc-900">
                  <span className="size-2 rounded-full bg-zinc-300" aria-hidden="true" />
                  {group.label}
                </h2>
                <ul className="space-y-3">
                  {group.events.map((event) => (
                    <li key={event.id}>
                      <EventCard event={event} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Main>
    </>
  )
}

function EventCard({ event }: { event: EventListItem }) {
  const when = parseEventDate(event.startsAt)
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.id }}
      className="flex gap-3 rounded-2xl bg-white p-3 pl-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/6 transition hover:ring-black/12 active:bg-zinc-50"
    >
      <div className="min-w-0 flex-1 py-0.5">
        {when && <p className="text-sm text-zinc-500">{when.time}</p>}
        <p className="truncate text-[17px] leading-snug font-semibold text-zinc-900">{event.name}</p>
        {event.venue && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-zinc-500">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{event.venue}</span>
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={event.role === 'host' ? 'dark' : 'neutral'}>
            {event.role === 'host' ? 'Host' : 'Door staff'}
          </Badge>
          <span className="text-xs text-zinc-500 tabular-nums">
            {event.ticketsSold} sold · {event.checkedIn} in
          </span>
        </div>
      </div>
      <EventCover name={event.name} className="size-20 rounded-xl text-xl" />
    </Link>
  )
}
