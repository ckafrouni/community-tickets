import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Badge, Card, EmailStatusBadge, Input, LocalTime, PageHeader, Stat, cx } from '#/components/ui'
import { listOrdersFn } from '#/functions/orders.functions'
import { formatMoney } from '#/lib/format'

export const Route = createFileRoute('/_staff/_admin/orders/')({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q ?? '' }),
  loader: ({ deps }) => listOrdersFn({ data: deps }),
  head: () => ({ meta: [{ title: 'Orders' }] }),
  component: OrdersPage,
})

function OrdersPage() {
  const { orders, stats, currency } = Route.useLoaderData()
  const { q = '' } = Route.useSearch()
  const navigate = useNavigate({ from: '/orders/' })
  const [query, setQuery] = useState(q)

  useEffect(() => {
    if (query.trim() === q) return
    const timer = setTimeout(() => {
      void navigate({ search: { q: query.trim() || undefined }, replace: true })
    }, 250)
    return () => clearTimeout(timer)
  }, [query, q, navigate])

  return (
    <>
      <PageHeader
        title="Orders"
        description="Everyone who has bought a ticket."
        actions={
          <>
            <a
              href="/api/orders.csv"
              className="inline-flex items-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50"
            >
              Export CSV
            </a>
            <Link
              to="/sell"
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              New sale
            </Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Tickets sold" value={stats.ticketsSold} />
        <Stat label="Cash collected" value={formatMoney(stats.revenue, currency)} />
        <Stat
          label="Checked in"
          value={stats.checkedIn}
          sub={stats.ticketsSold ? `${Math.round((stats.checkedIn / stats.ticketsSold) * 100)}% of tickets` : undefined}
        />
        <Stat label="Orders" value={stats.orders} />
      </div>

      <div className="mb-4">
        <Input
          type="search"
          placeholder="Search name, email, phone, order # or ticket code"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search orders"
        />
      </div>

      {orders.length === 0 ? (
        <Card className="py-12 text-center text-slate-600">
          {q ? (
            <>No orders match “{q}”.</>
          ) : (
            <>
              No sales yet.{' '}
              <Link to="/sell" className="font-semibold text-indigo-600 hover:underline">
                Record the first one
              </Link>
              .
            </>
          )}
        </Card>
      ) : (
        <Card className="!p-0">
          <ul className="divide-y divide-slate-100">
            {orders.map((order) => {
              const cancelled = order.cancelledAt !== null
              return (
                <li key={order.id}>
                  <Link
                    to="/orders/$orderId"
                    params={{ orderId: String(order.id) }}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50 sm:grid-cols-[3rem_1fr_7rem_10rem_14rem] sm:px-6"
                  >
                    <span className="hidden text-sm text-slate-500 tabular-nums sm:block">#{order.id}</span>
                    <span className="min-w-0">
                      <span className={cx('block truncate font-semibold', cancelled && 'text-slate-400 line-through')}>
                        {order.buyerName}
                      </span>
                      <span className="block truncate text-sm text-slate-500">
                        <span className="sm:hidden">#{order.id} · </span>
                        {order.buyerEmail || order.buyerPhone || 'No contact details'}
                      </span>
                    </span>
                    <span className="text-right text-sm sm:text-left">
                      <span className="block font-semibold tabular-nums">
                        {formatMoney(order.amount, order.currency)}
                      </span>
                      <span className="block text-slate-500">
                        {order.quantity} {order.quantity === 1 ? 'ticket' : 'tickets'}
                      </span>
                    </span>
                    <span className="hidden text-sm text-slate-500 sm:block">
                      <LocalTime iso={order.createdAt} />
                    </span>
                    <span className="col-span-2 flex flex-wrap gap-1.5 sm:col-span-1 sm:justify-end">
                      {cancelled ? (
                        <Badge tone="red">Cancelled</Badge>
                      ) : (
                        <Badge
                          tone={order.checkedIn === order.quantity ? 'green' : order.checkedIn ? 'amber' : 'neutral'}
                        >
                          {order.checkedIn}/{order.quantity} in
                        </Badge>
                      )}
                      <EmailStatusBadge status={order.emailStatus} />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </>
  )
}
