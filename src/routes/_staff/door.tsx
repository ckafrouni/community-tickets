import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QrCameraScanner } from '#/components/QrCameraScanner'
import { Alert, Badge, Button, Card, Input, LocalTime, Spinner, cx } from '#/components/ui'
import {
  checkInRemainingFn,
  checkInTicketFn,
  doorOverviewFn,
  scanTicketFn,
  searchTicketsFn,
  undoCheckInFn,
} from '#/functions/door.functions'
import { formatCode, plural } from '#/lib/format'
import { errorMessage } from '#/lib/schemas'
import { extractToken } from '#/lib/token'
import type { CheckInResult, TicketSummary } from '#/lib/types'

export const Route = createFileRoute('/_staff/door')({
  loader: () => doorOverviewFn(),
  head: () => ({ meta: [{ title: 'Door check-in' }] }),
  component: DoorPage,
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

function DoorPage() {
  const overview = Route.useLoaderData()
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
        const result = await scanTicketFn({ data: { token } })
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
    [feedback, refresh],
  )

  const dismiss = useCallback(() => {
    lastScanRef.current.at = Date.now()
    setOutcome(null)
  }, [])

  const percent = overview.ticketsSold ? Math.round((overview.checkedIn / overview.ticketsSold) * 100) : 0

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Door check-in</h1>
          <p className="text-sm font-semibold tabular-nums">
            {overview.checkedIn} / {overview.ticketsSold} in
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <Card className="!p-3">
        <QrCameraScanner onScan={handleScan} onStart={feedback.prime}>
          {outcome && <ScanResultOverlay outcome={outcome} onDismiss={dismiss} onChanged={refresh} />}
        </QrCameraScanner>
      </Card>

      <ManualLookup onChanged={refresh} onCheckedIn={() => feedback.play(true)} />

      {overview.recent.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Recent check-ins</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {overview.recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.buyerName}</span>
                  <span className="text-slate-500">
                    Ticket {t.seq}/{t.quantity} · {formatCode(t.code)}
                  </span>
                </span>
                <span className="shrink-0 text-slate-500">
                  {t.checkedInAt && <LocalTime iso={t.checkedInAt} mode="ago" />}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function ScanResultOverlay({
  outcome,
  onDismiss,
  onChanged,
}: {
  outcome: ScanOutcome
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

  let tone = 'bg-slate-700'
  let icon = '!'
  let title = 'Could not verify'
  let detail: React.ReactNode = outcome.kind === 'error' ? outcome.message : null

  if (result) {
    switch (result.status) {
      case 'checked_in':
        tone = 'bg-emerald-600'
        icon = '✓'
        title = 'Valid ticket: welcome!'
        break
      case 'already_checked_in':
        tone = 'bg-amber-500'
        icon = '!'
        title = 'Already checked in'
        detail = (
          <>
            This code was used <LocalTime iso={result.ticket.checkedInAt!} mode="ago" /> (at{' '}
            <LocalTime iso={result.ticket.checkedInAt!} mode="time" />
            ). If this isn't the same person, it may be a copied ticket.
          </>
        )
        break
      case 'cancelled':
        tone = 'bg-red-600'
        icon = '✕'
        title = 'Cancelled ticket: do not admit'
        detail = 'This order was cancelled or refunded.'
        break
      case 'invalid':
        tone = 'bg-red-600'
        icon = '✕'
        title = 'Not a valid ticket'
        detail = result.reason
        break
    }
  }

  return (
    <div className={cx('absolute inset-0 z-10 flex flex-col gap-3 overflow-y-auto p-4 text-white', tone)} role="alert">
      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/20 text-3xl font-bold">
          {icon}
        </div>
        <p className="text-lg font-bold">{title}</p>
        {ticket && (
          <>
            <p className="line-clamp-2 text-2xl font-extrabold break-words sm:text-3xl">{ticket.buyerName}</p>
            <p className="text-sm opacity-90">
              Ticket {ticket.seq} of {ticket.quantity} · {formatCode(ticket.code)} · Order #{ticket.orderId}
            </p>
          </>
        )}
        {detail && <p className="max-w-sm text-sm opacity-95">{detail}</p>}
        {result?.status === 'checked_in' && remaining > 0 && !note && (
          <p className="text-sm font-semibold">{plural(remaining, 'more ticket')} on this order not checked in yet.</p>
        )}
        {note && <p className="rounded bg-black/20 px-3 py-1 text-sm font-semibold">{note}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {result?.status === 'checked_in' && remaining > 0 && !note && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              act(async () => {
                const { count } = await checkInRemainingFn({ data: { orderId: result.ticket.orderId } })
                return `Admitted ${plural(count, 'more guest')}.`
              })
            }
          >
            {busy && <Spinner />} Admit {remaining} more
          </Button>
        )}
        {result?.status === 'checked_in' && !note && (
          <Button
            variant="ghost"
            className="!text-white hover:!bg-white/15"
            disabled={busy}
            onClick={() =>
              act(async () => {
                await undoCheckInFn({ data: { ticketId: result.ticket.id } })
                return 'Check-in undone.'
              })
            }
          >
            Undo
          </Button>
        )}
        <Button variant="secondary" onClick={onDismiss} autoFocus>
          Scan next
        </Button>
      </div>
    </div>
  )
}

function ManualLookup({ onChanged, onCheckedIn }: { onChanged: () => void; onCheckedIn: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TicketSummary[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [busyId, setBusyId] = useState<string | null>(null)
  const requestRef = useRef(0)

  const search = useCallback(async (q: string) => {
    const request = ++requestRef.current
    if (!q.trim()) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const rows = await searchTicketsFn({ data: { q } })
      if (request === requestRef.current) {
        setResults(rows)
        setError(undefined)
      }
    } catch (e) {
      if (request === requestRef.current) setError(errorMessage(e))
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void search(query), 250)
    return () => clearTimeout(timer)
  }, [query, search])

  async function toggle(ticket: TicketSummary) {
    setBusyId(ticket.id)
    try {
      if (ticket.checkedInAt) {
        await undoCheckInFn({ data: { ticketId: ticket.id } })
      } else {
        const result = await checkInTicketFn({ data: { ticketId: ticket.id } })
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
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">Find a guest</h2>
        <p className="text-sm text-slate-600">
          If a code won't scan, search by name, email or the code printed under the QR.
        </p>
      </div>
      <Input
        type="search"
        placeholder="Name, email or ticket code"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Find a guest"
      />
      {error && <Alert tone="red">{error}</Alert>}
      {loading && !results && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Searching…
        </p>
      )}
      {results && results.length === 0 && <p className="text-sm text-slate-500">No tickets found.</p>}
      {results && results.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {results.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate font-medium">{t.buyerName}</span>
                <span className="block text-sm text-slate-500">
                  Ticket {t.seq}/{t.quantity} · {formatCode(t.code)} · #{t.orderId}
                </span>
              </span>
              {t.cancelled ? (
                <Badge tone="red">Cancelled</Badge>
              ) : (
                <span className="flex shrink-0 items-center gap-2">
                  {t.checkedInAt && (
                    <span className="hidden text-xs text-slate-500 sm:inline">
                      in <LocalTime iso={t.checkedInAt} mode="time" />
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant={t.checkedInAt ? 'ghost' : 'success'}
                    disabled={busyId !== null}
                    onClick={() => void toggle(t)}
                  >
                    {busyId === t.id && <Spinner />}
                    {t.checkedInAt ? 'Undo' : 'Check in'}
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
