import { Link, createFileRoute } from '@tanstack/react-router'
import { CalendarPlus, MapPin, Plus } from 'lucide-react'
import { useState } from 'react'
import { AppHeader, Main } from '#/components/AppHeader'
import { EventCover } from '#/components/common'
import { Badge } from '#/components/ui/badge'
import { buttonVariants } from '#/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '#/components/ui/item'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { listEventsFn } from '#/functions/events.functions'
import { parseEventDate } from '#/lib/format'
import { ROLE_LABELS } from '#/lib/roles'
import type { EventListItem } from '#/lib/types'

export const Route = createFileRoute('/_app/events/')({
  loader: () => listEventsFn(),
  head: () => ({ meta: [{ title: 'Événements · Community Tickets' }] }),
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
      group = { key, label: when ? when.date : 'Date à venir', events: [] }
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
  const shown = tab === 'upcoming' ? events.filter((e) => !isPast(e)) : events.filter(isPast).reverse()

  return (
    <>
      <AppHeader title="Community Tickets" />
      <Main>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="font-heading text-[28px] leading-tight font-semibold tracking-tight">Événements</h1>
          <Link to="/events/new" className={buttonVariants()}>
            <Plus data-icon="inline-start" /> Créer
          </Link>
        </div>

        {events.length > 0 && (
          <ToggleGroup
            aria-label="Afficher"
            variant="outline"
            spacing={0}
            value={[tab]}
            onValueChange={(value) => value[0] && setTab(value[0] as Tab)}
            className="mb-5"
          >
            <ToggleGroupItem value="upcoming">À venir</ToggleGroupItem>
            <ToggleGroupItem value="past">Passés</ToggleGroupItem>
          </ToggleGroup>
        )}

        {shown.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarPlus />
              </EmptyMedia>
              <EmptyTitle>
                {events.length === 0
                  ? 'Créez votre premier événement'
                  : tab === 'upcoming'
                    ? 'Aucun événement à venir'
                    : 'Aucun événement passé'}
              </EmptyTitle>
              {events.length === 0 && (
                <EmptyDescription>
                  Vendez des billets, envoyez les QR codes par e-mail et accueillez vos invités à l’entrée.
                </EmptyDescription>
              )}
            </EmptyHeader>
            {events.length === 0 && (
              <EmptyContent>
                <Link to="/events/new" className={buttonVariants()}>
                  Créer un événement
                </Link>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <div className="flex flex-col gap-6">
            {groupByDay(shown).map((group) => (
              <section key={group.key}>
                <h2 className="mb-2 flex items-center gap-2 px-1 text-[15px] font-semibold">
                  <span className="size-2 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                  {group.label}
                </h2>
                <ItemGroup className="gap-3">
                  {group.events.map((event) => (
                    <EventItem key={event.id} event={event} />
                  ))}
                </ItemGroup>
              </section>
            ))}
          </div>
        )}
      </Main>
    </>
  )
}

function EventItem({ event }: { event: EventListItem }) {
  const when = parseEventDate(event.startsAt)
  return (
    <Item
      variant="outline"
      className="bg-card shadow-sm"
      render={<Link to="/events/$eventId" params={{ eventId: event.id }} />}
    >
      <ItemContent className="min-w-0">
        {when && <ItemDescription>{when.time}</ItemDescription>}
        <ItemTitle className="text-base">{event.name}</ItemTitle>
        {event.venue && (
          <ItemDescription className="flex items-center gap-1">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{event.venue}</span>
          </ItemDescription>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Badge variant={event.role === 'organizer' ? 'default' : 'secondary'}>{ROLE_LABELS[event.role]}</Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            {event.ticketsSold} vendus · {event.checkedIn} arrivés
          </span>
        </div>
      </ItemContent>
      <ItemMedia variant="image" className="size-20 rounded-2xl">
        <EventCover name={event.name} className="size-full text-xl" />
      </ItemMedia>
    </Item>
  )
}
