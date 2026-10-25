import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Download, MailX, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  List,
  PageHeader,
  SearchInput,
  Segmented,
  buttonClass,
  cx,
  interactiveRowClass,
} from '#/components/ui'
import { listOrdersFn } from '#/functions/orders.functions'
import { formatMoney, plural } from '#/lib/format'
import type { OrderSummary } from '#/lib/types'

export const Route = createFileRoute('/_app/events/$eventId/_host/guests/')({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q ?? '' }),
  loader: ({ deps, params }) => listOrdersFn({ data: { eventId: params.eventId, q: deps.q } }),
  head: () => ({ meta: [{ title: 'Guests' }] }),
  component: GuestsPage,
})

type Filter = 'all' | 'waiting' | 'arrived'

function matches(order: OrderSummary, filter: Filter) {
  if (filter === 'all') return true
  if (order.cancelledAt) return false
  return filter === 'arrived' ? order.checkedIn > 0 : order.checkedIn < order.quantity
}

function GuestsPage() {
  const { orders, stats, currency } = Route.useLoaderData()
  const { eventId } = Route.useParams()
  const { q = '' } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [query, setQuery] = useState(q)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    if (query.trim() === q) return
    const timer = setTimeout(() => {
      void navigate({ search: { q: query.trim() || undefined }, replace: true })
    }, 250)
    return () => clearTimeout(timer)
  }, [query, q, navigate])

  const shown = orders.filter((o) => matches(o, filter))
  const percent = stats.ticketsSold ? Math.round((stats.checkedIn / stats.ticketsSold) * 100) : 0

  return (
    <>
      <PageHeader
        title="Guests"
        description={`${plural(stats.orders, 'order')} · ${plural(stats.ticketsSold, 'ticket')}`}
        actions={
          orders.length > 0 && (
            <a
              href={`/api/events/${eventId}/guests.csv`}
              className={buttonClass('secondary', 'icon')}
              aria-label="Export guest list (CSV)"
              title="Export CSV"
            >
              <Download className="size-5" />
            </a>
          )
        }
      />

      <Card className="mb-4 grid grid-cols-3 divide-x divide-zinc-100 !px-0 !py-3.5 text-center">
        <Stat label="Sold" value={String(stats.ticketsSold)} />
        <div className="px-2">
          <p className="text-xs font-medium text-zinc-500">Checked in</p>
          <p className="text-xl font-bold tabular-nums">{stats.checkedIn}</p>
          <div className="mx-auto mt-1 h-1 w-14 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <Stat label="Cash" value={formatMoney(stats.revenue, currency)} />
      </Card>

      {(orders.length > 0 || q) && (
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 space-y-3 bg-zinc-100/90 px-4 py-2 backdrop-blur-xl md:top-[calc(6rem+env(safe-area-inset-top))]">
          <SearchInput
            placeholder="Search guests or ticket code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search guests"
          />
          <Segmented
            label="Filter guests"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'waiting', label: 'Not arrived' },
              { value: 'arrived', label: 'Arrived' },
            ]}
          />
        </div>
      )}

      <div className="mt-2">
        {orders.length === 0 && !q ? (
          <EmptyState icon={<Users />} title="No guests yet">
            <p>Everyone you sell a ticket to shows up here.</p>
            <Link to="/events/$eventId/sell" params={{ eventId }} className={buttonClass('primary', 'md', 'mt-4')}>
              Sell the first ticket
            </Link>
          </EmptyState>
        ) : shown.length === 0 ? (
          <p className="px-1 py-10 text-center text-sm text-zinc-500">
            {q ? <>No guests match “{q}”.</> : 'Nobody here yet.'}
          </p>
        ) : (
          <List>
            {shown.map((order) => (
              <li key={order.id}>
                <GuestRow order={order} eventId={eventId} />
              </li>
            ))}
          </List>
        )}
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-2">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="truncate text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function GuestRow({ order, eventId }: { order: OrderSummary; eventId: string }) {
  const cancelled = order.cancelledAt !== null
  return (
    <Link
      to="/events/$eventId/guests/$orderId"
      params={{ eventId, orderId: String(order.id) }}
      className={interactiveRowClass}
    >
      <Avatar name={order.buyerName} />
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate font-semibold', cancelled && 'text-zinc-400 line-through')}>
          {order.buyerName}
        </span>
        <span className="flex items-center gap-1 truncate text-sm text-zinc-500">
          {order.emailStatus === 'failed' && (
            <MailX className="size-3.5 shrink-0 text-red-500" aria-label="Email failed" />
          )}
          <span className="truncate">
            {plural(order.quantity, 'ticket')} · {formatMoney(order.amount, order.currency)}
          </span>
        </span>
      </span>
      {cancelled ? (
        <Badge tone="red">Cancelled</Badge>
      ) : order.checkedIn === order.quantity ? (
        <Badge tone="green">Arrived</Badge>
      ) : order.checkedIn > 0 ? (
        <Badge tone="amber">
          {order.checkedIn}/{order.quantity} in
        </Badge>
      ) : null}
      <ChevronRight className="size-5 shrink-0 text-zinc-300" />
    </Link>
  )
}
