import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Check, RotateCcw, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QrCameraScanner } from '#/components/QrCameraScanner'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  List,
  LocalTime,
  SearchInput,
  SectionTitle,
  Spinner,
  cx,
  rowClass,
} from '#/components/ui'
import {
  checkInOverviewFn,
  checkInRemainingFn,
  checkInTicketFn,
  scanTicketFn,
  searchTicketsFn,
  undoCheckInFn,
} from '#/functions/door.functions'
import { formatCode, plural } from '#/lib/format'
import { errorMessage } from '#/lib/schemas'
import { extractToken } from '#/lib/token'
import type { CheckInResult, TicketSummary } from '#/lib/types'

export const Route = createFileRoute('/_app/events/$eventId/check-in')({
  loader: ({ params }) => checkInOverviewFn({ data: { eventId: params.eventId } }),
  head: () => ({ meta: [{ title: 'Check in' }] }),
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
          result: { status: 'invalid', reason: "This QR code isn't a ticket for this event." },
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
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Check in</h1>
          <p className="text-[15px] font-semibold text-zinc-500 tabular-nums">
            <span className="text-zinc-900">{overview.checkedIn}</span> / {overview.ticketsSold}
          </p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200" aria-hidden="true">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <QrCameraScanner onScan={handleScan} onStart={feedback.prime}>
        {outcome && <ScanResultOverlay outcome={outcome} eventId={eventId} onDismiss={dismiss} onChanged={refresh} />}
      </QrCameraScanner>

      <ManualLookup eventId={eventId} onChanged={refresh} onCheckedIn={() => feedback.play(true)} />

      {overview.recent.length > 0 && (
        <section>
          <SectionTitle>Recently checked in</SectionTitle>
          <List>
            {overview.recent.map((t) => (
              <li key={t.id} className={rowClass}>
                <Avatar name={t.buyerName} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t.buyerName}</span>
                  <span className="block text-sm text-zinc-500">
                    {t.seq} of {t.quantity} · {formatCode(t.code)}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-zinc-400">
                  {t.checkedInAt && <LocalTime iso={t.checkedInAt} mode="ago" />}
                </span>
              </li>
            ))}
          </List>
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

  let tone = 'bg-zinc-800'
  let icon = <TriangleAlert className="size-7" />
  let title = 'Could not verify'
  let detail: React.ReactNode = outcome.kind === 'error' ? outcome.message : null

  if (result) {
    switch (result.status) {
      case 'checked_in':
        tone = 'bg-emerald-600'
        icon = <Check className="size-7" strokeWidth={3} />
        title = 'Welcome!'
        break
      case 'already_checked_in':
        tone = 'bg-amber-500'
        icon = <TriangleAlert className="size-7" />
        title = 'Already checked in'
        detail = (
          <>
            Used <LocalTime iso={result.ticket.checkedInAt!} mode="ago" /> (at{' '}
            <LocalTime iso={result.ticket.checkedInAt!} mode="time" />
            ). If this isn't the same person, it may be a copied ticket.
          </>
        )
        break
      case 'cancelled':
        tone = 'bg-red-600'
        icon = <X className="size-7" strokeWidth={3} />
        title = 'Cancelled: do not admit'
        detail = 'This order was cancelled or refunded.'
        break
      case 'invalid':
        tone = 'bg-red-600'
        icon = <X className="size-7" strokeWidth={3} />
        title = 'Not a valid ticket'
        detail = result.reason
        break
    }
  }

  return (
    <div className={cx('absolute inset-0 z-10 flex flex-col gap-3 overflow-y-auto p-5 text-white', tone)} role="alert">
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/20">{icon}</div>
        <p className="text-lg font-bold">{title}</p>
        {ticket && (
          <>
            <p className="line-clamp-2 text-3xl leading-tight font-extrabold break-words">{ticket.buyerName}</p>
            <p className="text-sm opacity-90">
              Ticket {ticket.seq} of {ticket.quantity} · {formatCode(ticket.code)}
            </p>
          </>
        )}
        {detail && <p className="max-w-xs text-sm opacity-95">{detail}</p>}
        {result?.status === 'checked_in' && remaining > 0 && !note && (
          <p className="text-sm font-semibold">{plural(remaining, 'more ticket')} on this order not checked in yet.</p>
        )}
        {note && <p className="rounded-full bg-black/20 px-3 py-1 text-sm font-semibold">{note}</p>}
      </div>
      <div className="grid gap-2">
        {result?.status === 'checked_in' && remaining > 0 && !note && (
          <Button
            size="lg"
            className="!bg-white !text-zinc-900"
            disabled={busy}
            onClick={() =>
              act(async () => {
                const { count } = await checkInRemainingFn({ data: { eventId, orderId: result.ticket.orderId } })
                return `Admitted ${plural(count, 'more guest')}.`
              })
            }
          >
            {busy && <Spinner />} Admit {remaining} more
          </Button>
        )}
        <div className="grid grid-cols-[auto_1fr] gap-2">
          {result?.status === 'checked_in' && !note ? (
            <Button
              variant="ghost"
              size="lg"
              className="!text-white hover:!bg-white/15"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await undoCheckInFn({ data: { eventId, ticketId: result.ticket.id } })
                  return 'Check-in undone.'
                })
              }
            >
              <RotateCcw className="size-5" /> Undo
            </Button>
          ) : (
            <span />
          )}
          <Button size="lg" className="!bg-black/25 hover:!bg-black/35" onClick={onDismiss} autoFocus>
            Scan next
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
  const [error, setError] = useState<string>()
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
        if (request === requestRef.current) {
          setResults(rows)
          setError(undefined)
        }
      } catch (e) {
        if (request === requestRef.current) setError(errorMessage(e))
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
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-3">
      <SectionTitle>Find a guest</SectionTitle>
      <SearchInput
        placeholder="Name, email or ticket code"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Find a guest"
      />
      {error && <Alert tone="red">{error}</Alert>}
      {loading && !results && (
        <p className="flex items-center gap-2 px-1 text-sm text-zinc-500">
          <Spinner /> Searching…
        </p>
      )}
      {results && results.length === 0 && <p className="px-1 text-sm text-zinc-500">No tickets found.</p>}
      {results && results.length > 0 && (
        <List>
          {results.map((t) => (
            <li key={t.id} className={rowClass}>
              <Avatar name={t.buyerName} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{t.buyerName}</span>
                <span className="block text-sm text-zinc-500">
                  {t.seq} of {t.quantity} · {formatCode(t.code)}
                </span>
              </span>
              {t.cancelled ? (
                <Badge tone="red">Cancelled</Badge>
              ) : (
                <Button
                  size="sm"
                  variant={t.checkedInAt ? 'soft' : 'success'}
                  disabled={busyId !== null}
                  onClick={() => void toggle(t)}
                  className="min-w-24"
                >
                  {busyId === t.id && <Spinner />}
                  {t.checkedInAt ? 'Undo' : 'Check in'}
                </Button>
              )}
            </li>
          ))}
        </List>
      )}
    </section>
  )
}
