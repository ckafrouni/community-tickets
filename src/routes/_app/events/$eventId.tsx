import { Link, Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { CalendarX2, CirclePlus, ScanLine, Settings, Users } from 'lucide-react'
import { AppHeader, Main } from '#/components/AppHeader'
import { buttonVariants } from '#/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { getEventFn } from '#/functions/events.functions'
import { describeEventDate } from '#/lib/format'

export const Route = createFileRoute('/_app/events/$eventId')({
  beforeLoad: async ({ params }) => {
    const access = await getEventFn({ data: { eventId: params.eventId } })
    if (!access) throw notFound()
    return access
  },
  notFoundComponent: EventNotFound,
  component: EventLayout,
})

const TABS = [
  { to: '/events/$eventId/sell', label: 'Sell', icon: CirclePlus },
  { to: '/events/$eventId/guests', label: 'Guests', icon: Users },
  { to: '/events/$eventId/check-in', label: 'Check in', icon: ScanLine },
  { to: '/events/$eventId/settings', label: 'Settings', icon: Settings },
] as const

function EventLayout() {
  const { event, role } = Route.useRouteContext()
  const isOrganizer = role === 'organizer'
  const subtitle = [event.startsAt ? describeEventDate(event.startsAt) : '', event.venue].filter(Boolean).join(' · ')

  return (
    <>
      <AppHeader back title={event.name} subtitle={subtitle || undefined}>
        {isOrganizer && (
          <nav aria-label="Event" className="mx-auto hidden max-w-3xl gap-1 px-4 pb-2.5 md:flex">
            {TABS.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                params={{ eventId: event.id }}
                className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'text-muted-foreground' })}
                activeProps={{ className: '!bg-muted !text-foreground' }}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}
      </AppHeader>

      <Main tabBar={isOrganizer}>
        <Outlet />
      </Main>

      {isOrganizer && (
        <nav
          aria-label="Event"
          className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        >
          <div className="mx-auto grid max-w-md grid-cols-4">
            {TABS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                params={{ eventId: event.id }}
                className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition active:text-foreground"
                activeProps={{ className: '!text-foreground' }}
              >
                <Icon className="size-6" strokeWidth={1.75} />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  )
}

function EventNotFound() {
  return (
    <>
      <AppHeader back title="Event not found" />
      <Main>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarX2 />
            </EmptyMedia>
            <EmptyTitle>Event not found</EmptyTitle>
            <EmptyDescription>It doesn't exist, or you're not on its team.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link to="/events" className={buttonVariants({ variant: 'outline' })}>
              Back to events
            </Link>
          </EmptyContent>
        </Empty>
      </Main>
    </>
  )
}
