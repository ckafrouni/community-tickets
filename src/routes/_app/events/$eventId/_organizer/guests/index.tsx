import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Download, MailX, Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader, PersonAvatar } from '#/components/common'
import { Badge } from '#/components/ui/badge'
import { buttonVariants } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '#/components/ui/input-group'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '#/components/ui/item'
import { Progress } from '#/components/ui/progress'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { listOrdersFn } from '#/functions/orders.functions'
import { formatMoney, plural } from '#/lib/format'
import type { OrderSummary } from '#/lib/types'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_app/events/$eventId/_organizer/guests/')({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q ?? '' }),
  loader: ({ deps, params }) => listOrdersFn({ data: { eventId: params.eventId, q: deps.q } }),
  head: () => ({ meta: [{ title: 'Invités' }] }),
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
        title="Invités"
        description={`${plural(stats.orders, 'commande')} · ${plural(stats.ticketsSold, 'billet')}`}
        actions={
          orders.length > 0 && (
            <a
              href={`/api/events/${eventId}/guests.csv`}
              className={buttonVariants({ variant: 'outline', size: 'icon' })}
              aria-label="Exporter la liste des invités (CSV)"
              title="Exporter en CSV"
            >
              <Download />
            </a>
          )
        }
      />

      <Card size="sm" className="mb-4">
        <CardContent className="grid grid-cols-3 divide-x text-center">
          <Stat label="Vendus" value={String(stats.ticketsSold)} />
          <div className="px-2">
            <p className="text-xs text-muted-foreground">Arrivés</p>
            <p className="text-xl font-semibold tabular-nums">{stats.checkedIn}</p>
            <Progress value={percent} aria-label="Arrivés" className="mx-auto mt-1 w-14" />
          </div>
          <Stat label="Encaissé" value={formatMoney(stats.revenue, currency)} />
        </CardContent>
      </Card>

      {(orders.length > 0 || q) && (
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 flex flex-col gap-3 bg-background/90 px-4 py-2 backdrop-blur-xl md:top-[calc(6rem+env(safe-area-inset-top))]">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              autoComplete="off"
              placeholder="Rechercher un invité ou un code"
              aria-label="Rechercher un invité"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          <ToggleGroup
            aria-label="Filtrer les invités"
            variant="outline"
            spacing={0}
            value={[filter]}
            onValueChange={(value) => value[0] && setFilter(value[0] as Filter)}
          >
            <ToggleGroupItem value="all">Tous</ToggleGroupItem>
            <ToggleGroupItem value="waiting">Pas arrivés</ToggleGroupItem>
            <ToggleGroupItem value="arrived">Arrivés</ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      <div className="mt-2">
        {orders.length === 0 && !q ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users />
              </EmptyMedia>
              <EmptyTitle>Pas encore d’invités</EmptyTitle>
              <EmptyDescription>Chaque personne à qui vous vendez un billet apparaît ici.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link to="/events/$eventId/sell" params={{ eventId }} className={buttonVariants()}>
                Vendre le premier billet
              </Link>
            </EmptyContent>
          </Empty>
        ) : shown.length === 0 ? (
          <p className="px-1 py-10 text-center text-sm text-muted-foreground">
            {q ? <>Aucun invité ne correspond à « {q} ».</> : 'Personne pour l’instant.'}
          </p>
        ) : (
          <ItemGroup className="gap-2">
            {shown.map((order) => (
              <GuestItem key={order.id} order={order} eventId={eventId} />
            ))}
          </ItemGroup>
        )}
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function GuestItem({ order, eventId }: { order: OrderSummary; eventId: string }) {
  const cancelled = order.cancelledAt !== null
  return (
    <Item
      variant="outline"
      size="sm"
      className="bg-card"
      render={<Link to="/events/$eventId/guests/$orderId" params={{ eventId, orderId: String(order.id) }} />}
    >
      <ItemMedia>
        <PersonAvatar name={order.buyerName} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className={cn('w-full truncate', cancelled && 'text-muted-foreground line-through')}>
          {order.buyerName}
        </ItemTitle>
        <ItemDescription className="flex items-center gap-1">
          {order.emailStatus === 'failed' && (
            <MailX className="size-3.5 shrink-0 text-destructive" aria-label="Échec de l’e-mail" />
          )}
          {plural(order.quantity, 'billet')} · {formatMoney(order.amount, order.currency)}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {cancelled ? (
          <Badge variant="destructive">Annulée</Badge>
        ) : order.checkedIn === order.quantity ? (
          <Badge variant="success">Arrivé</Badge>
        ) : order.checkedIn > 0 ? (
          <Badge variant="warning">
            {order.checkedIn}/{order.quantity} arrivés
          </Badge>
        ) : null}
        <ChevronRight className="size-4 text-muted-foreground" />
      </ItemActions>
    </Item>
  )
}
