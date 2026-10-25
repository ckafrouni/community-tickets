import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Check, RotateCcw, Search, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { LocalTime, PersonAvatar, SectionTitle } from '#/components/common'
import { QrCameraScanner } from '#/components/QrCameraScanner'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '#/components/ui/input-group'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '#/components/ui/item'
import { Progress } from '#/components/ui/progress'
import { Spinner } from '#/components/ui/spinner'
import {
  checkInOverviewFn,
  checkInRemainingFn,
  checkInTicketFn,
  scanTicketFn,
  searchTicketsFn,
  undoCheckInFn,
} from '#/functions/check-in.functions'
import { formatCode, plural } from '#/lib/format'
import { errorMessage } from '#/lib/schemas'
import { extractToken } from '#/lib/token'
import type { CheckInResult, TicketSummary } from '#/lib/types'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_app/events/$eventId/check-in')({
  loader: ({ params }) => checkInOverviewFn({ data: { eventId: params.eventId } }),
  head: () => ({ meta: [{ title: 'Check-in' }] }),
  component: CheckInPage,
})

type ScanOutcome = { kind: 'result'; result: CheckInResult } | { kind: 'error'; message: string }

function useFeedback() {
  const ctxRef = useRef<AudioContext | null>(null)
  const prime = useCallback(() => {
    try {
      ctxRef.current ??= new AudioContext()
      void ctxRef.current.resume()
    } catch {}
  }, [])
  const play = useCallback((ok: boolean) => {
    navigator.vibrate?.(ok ? 80 : [180, 80, 180])
    const ctx = ctxRef.current
    if (!ctx || ctx.state !== 'running') return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const duration = ok ? 0.15 : 0.45
    osc.type = ok ? 'sine' : 'square'
    osc.frequency.value = ok ? 880 : 180
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  }, [])
  return useMemo(() => ({ prime, play }), [prime, play])
}

function CheckInPage() {
  const overview = Route.useLoaderData()
  const { eventId } = Route.useParams()
  const router = useRouter()
  const feedback = useFeedback()
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null)
  const outcomeRef = useRef(outcome)
  const busyRef = useRef(false)
  const lastScanRef = useRef({ text: '', at: 0 })

  useEffect(() => {
    outcomeRef.current = outcome
  }, [outcome])

  const refresh = useCallback(() => router.invalidate(), [router])

  const handleScan = useCallback(
    async (text: string) => {
      if (busyRef.current || outcomeRef.current) return
      const now = Date.now()
      if (text === lastScanRef.current.text && now - lastScanRef.current.at < 3000) return
      lastScanRef.current = { text, at: now }

      const token = extractToken(text)
      if (!token) {
        feedback.play(false)
        setOutcome({
          kind: 'result',
          result: { status: 'invalid', reason: 'Ce QR code n’est pas un billet de cet événement.' },
        })
        return
      }
      busyRef.current = true
      try {
        const result = await scanTicketFn({ data: { eventId, token } })
        feedback.play(result.status === 'checked_in')
        setOutcome({ kind: 'result', result })
        void refresh()
      } catch (e) {
        feedback.play(false)
        setOutcome({ kind: 'error', message: errorMessage(e) })
      } finally {
        busyRef.current = false
      }
    },
    [eventId, feedback, refresh],
  )

  const dismiss = useCallback(() => {
    lastScanRef.current.at = Date.now()
    setOutcome(null)
  }, [])

  const percent = overview.ticketsSold ? Math.round((overview.checkedIn / overview.ticketsSold) * 100) : 0

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-heading text-[28px] leading-tight font-semibold tracking-tight">Check-in</h1>
          <p className="text-[15px] font-semibold text-muted-foreground tabular-nums">
            <span className="text-foreground">{overview.checkedIn}</span> / {overview.ticketsSold}
          </p>
        </div>
        <Progress value={percent} aria-label="Invités arrivés" className="mt-3" />
      </div>

      <QrCameraScanner onScan={handleScan} onStart={feedback.prime}>
        {outcome && <ScanResultOverlay outcome={outcome} eventId={eventId} onDismiss={dismiss} onChanged={refresh} />}
      </QrCameraScanner>

      <ManualLookup eventId={eventId} onChanged={refresh} onCheckedIn={() => feedback.play(true)} />

      {overview.recent.length > 0 && (
        <section>
          <SectionTitle>Derniers arrivés</SectionTitle>
          <ItemGroup className="gap-2">
            {overview.recent.map((t) => (
              <Item key={t.id} variant="outline" size="sm" className="bg-card">
                <ItemMedia>
                  <PersonAvatar name={t.buyerName} />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full truncate">{t.buyerName}</ItemTitle>
                  <ItemDescription>
                    {t.seq} sur {t.quantity} · {formatCode(t.code)}
                  </ItemDescription>
                </ItemContent>
                <ItemActions className="text-sm text-muted-foreground">
                  {t.checkedInAt && <LocalTime iso={t.checkedInAt} mode="ago" />}
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </section>
      )}
    </div>
  )
}

function ScanResultOverlay({
  outcome,
  eventId,
  onDismiss,
  onChanged,
}: {
  outcome: ScanOutcome
  eventId: string
  onDismiss: () => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string>()
  const result = outcome.kind === 'result' ? outcome.result : null
  const ticket = result && 'ticket' in result ? result.ticket : null
  const remaining = ticket ? ticket.quantity - ticket.orderCheckedIn : 0
  const autoDismiss = result?.status === 'checked_in' && remaining === 0 && !note

  useEffect(() => {
    if (!autoDismiss) return
    const timer = setTimeout(onDismiss, 2500)
    return () => clearTimeout(timer)
  }, [autoDismiss, onDismiss])

  async function act(fn: () => Promise<string>) {
    setBusy(true)
    try {
      setNote(await fn())
      onChanged()
    } catch (e) {
      setNote(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  let tone = 'bg-neutral-800'
  let icon = <TriangleAlert className="size-7" />
  let title = 'Vérification impossible'
  let detail: React.ReactNode = outcome.kind === 'error' ? outcome.message : null

  if (result) {
    switch (result.status) {
      case 'checked_in':
        tone = 'bg-emerald-600'
        icon = <Check className="size-7" strokeWidth={3} />
        title = 'Bienvenue !'
        break
      case 'already_checked_in':
        tone = 'bg-amber-500'
        icon = <TriangleAlert className="size-7" />
        title = 'Check-in déjà fait'
        detail = (
          <>
            Utilisé <LocalTime iso={result.ticket.checkedInAt!} mode="ago" /> (à{' '}
            <LocalTime iso={result.ticket.checkedInAt!} mode="time" />
            ). Si ce n’est pas la même personne, le billet a peut-être été copié.
          </>
        )
        break
      case 'cancelled':
        tone = 'bg-red-600'
        icon = <X className="size-7" strokeWidth={3} />
        title = 'Annulé : ne pas faire entrer'
        detail = 'Cette commande a été annulée ou remboursée.'
        break
      case 'invalid':
        tone = 'bg-red-600'
        icon = <X className="size-7" strokeWidth={3} />
        title = 'Billet non valide'
        detail = result.reason
        break
    }
  }

  return (
    <div className={cn('absolute inset-0 z-10 flex flex-col gap-3 overflow-y-auto p-5 text-white', tone)} role="alert">
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/20">{icon}</div>
        <p className="text-lg font-semibold">{title}</p>
        {ticket && (
          <>
            <p className="line-clamp-2 font-heading text-3xl leading-tight font-bold break-words">{ticket.buyerName}</p>
            <p className="text-sm opacity-90">
              Billet {ticket.seq} sur {ticket.quantity} · {formatCode(ticket.code)}
            </p>
          </>
        )}
        {detail && <p className="max-w-xs text-sm opacity-95">{detail}</p>}
        {result?.status === 'checked_in' && remaining > 0 && !note && (
          <p className="text-sm font-semibold">{plural(remaining, 'autre billet')} de cette commande sans check-in.</p>
        )}
        {note && <p className="rounded-full bg-black/20 px-3 py-1 text-sm font-semibold">{note}</p>}
      </div>
      <div className="grid gap-2">
        {result?.status === 'checked_in' && remaining > 0 && !note && (
          <Button
            size="lg"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              act(async () => {
                const { count } = await checkInRemainingFn({ data: { eventId, orderId: result.ticket.orderId } })
                return `${plural(count, 'check-in')} de plus.`
              })
            }
          >
            {busy && <Spinner />} {remaining > 1 ? `Check-in des ${remaining} autres` : 'Check-in de l’autre billet'}
          </Button>
        )}
        <div className="grid grid-cols-[auto_1fr] gap-2">
          {result?.status === 'checked_in' && !note ? (
            <Button
              variant="ghost"
              size="lg"
              className="text-white hover:bg-white/15 hover:text-white"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await undoCheckInFn({ data: { eventId, ticketId: result.ticket.id } })
                  return 'Check-in annulé.'
                })
              }
            >
              <RotateCcw /> Annuler
            </Button>
          ) : (
            <span />
          )}
          <Button size="lg" className="bg-black/25 text-white hover:bg-black/35" onClick={onDismiss} autoFocus>
            Suivant
          </Button>
        </div>
      </div>
    </div>
  )
}

function ManualLookup({
  eventId,
  onChanged,
  onCheckedIn,
}: {
  eventId: string
  onChanged: () => void
  onCheckedIn: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TicketSummary[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const requestRef = useRef(0)

  const search = useCallback(
    async (q: string) => {
      const request = ++requestRef.current
      if (!q.trim()) {
        setResults(null)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const rows = await searchTicketsFn({ data: { eventId, q } })
        if (request === requestRef.current) setResults(rows)
      } catch (e) {
        if (request === requestRef.current) toast.error(errorMessage(e))
      } finally {
        if (request === requestRef.current) setLoading(false)
      }
    },
    [eventId],
  )

  useEffect(() => {
    const timer = setTimeout(() => void search(query), 250)
    return () => clearTimeout(timer)
  }, [query, search])

  async function toggle(ticket: TicketSummary) {
    setBusyId(ticket.id)
    try {
      if (ticket.checkedInAt) {
        await undoCheckInFn({ data: { eventId, ticketId: ticket.id } })
      } else {
        const result = await checkInTicketFn({ data: { eventId, ticketId: ticket.id } })
        if (result.status === 'checked_in') onCheckedIn()
      }
      await search(query)
      onChanged()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Trouver un invité</SectionTitle>
      <InputGroup>
        <InputGroupAddon>{loading ? <Spinner /> : <Search />}</InputGroupAddon>
        <InputGroupInput
          type="search"
          autoComplete="off"
          placeholder="Nom, e-mail ou code du billet"
          aria-label="Trouver un invité"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>
      {results && results.length === 0 && <p className="px-1 text-sm text-muted-foreground">Aucun billet trouvé.</p>}
      {results && results.length > 0 && (
        <ItemGroup className="gap-2">
          {results.map((t) => (
            <Item key={t.id} variant="outline" size="sm" className="bg-card">
              <ItemMedia>
                <PersonAvatar name={t.buyerName} />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="w-full truncate">{t.buyerName}</ItemTitle>
                <ItemDescription>
                  {t.seq} sur {t.quantity} · {formatCode(t.code)}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                {t.cancelled ? (
                  <Badge variant="destructive">Annulé</Badge>
                ) : (
                  <Button
                    variant={t.checkedInAt ? 'secondary' : 'default'}
                    disabled={busyId !== null}
                    onClick={() => void toggle(t)}
                    className="min-w-24"
                  >
                    {busyId === t.id && <Spinner />}
                    {t.checkedInAt ? 'Annuler' : 'Check-in'}
                  </Button>
                )}
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </section>
  )
}
