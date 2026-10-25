import { Link, createFileRoute, notFound, useHydrated, useRouter } from '@tanstack/react-router'
import { Ban, ChevronLeft, CircleCheck, Copy, Mail, Pencil, RotateCcw, Share, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmailStatusBadge, LocalTime, PersonAvatar, QrImage, SectionTitle } from '#/components/common'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import { Badge } from '#/components/ui/badge'
import { Button, buttonVariants } from '#/components/ui/button'
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '#/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '#/components/ui/dialog'
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '#/components/ui/drawer'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { checkInTicketFn, undoCheckInFn } from '#/functions/check-in.functions'
import { getOrderFn, resendEmailFn, setOrderCancelledFn, updateOrderFn } from '#/functions/orders.functions'
import { formatCode, formatMoney, plural } from '#/lib/format'
import { errorMessage } from '#/lib/schemas'
import type { OrderDetail, OrderTicket } from '#/lib/types'

export const Route = createFileRoute('/_app/events/$eventId/_organizer/guests/$orderId')({
  validateSearch: (search: Record<string, unknown>): { created?: boolean } => ({
    created: search.created === true || search.created === 'true' ? true : undefined,
  }),
  loader: ({ params }) => {
    const id = Number(params.orderId)
    if (!Number.isInteger(id) || id <= 0) throw notFound()
    return getOrderFn({ data: { eventId: params.eventId, id } })
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? loaderData.buyerName : 'Invité' }] }),
  notFoundComponent: () => (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Ban />
        </EmptyMedia>
        <EmptyTitle>Invité introuvable</EmptyTitle>
      </EmptyHeader>
    </Empty>
  ),
  component: GuestPage,
})

function useAction() {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  async function run(key: string, fn: () => Promise<string | void>) {
    setBusy(key)
    try {
      const message = await fn()
      await router.invalidate()
      if (message) toast.success(message)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  return { busy, run }
}

function GuestPage() {
  const order = Route.useLoaderData()
  const { eventId } = Route.useParams()
  const { created } = Route.useSearch()
  const { busy, run } = useAction()
  const cancelled = order.cancelledAt !== null
  const arrived = order.checkedIn

  function resend() {
    return run('email', async () => {
      const result = await resendEmailFn({ data: { eventId, id: order.id } })
      if (result.status === 'failed') throw new Error(`Échec de l’e-mail : ${result.error}`)
      return `Billets envoyés à ${order.buyerEmail}.`
    })
  }

  return (
    <>
      <Link
        to="/events/$eventId/guests"
        params={{ eventId }}
        className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2 mb-2 text-muted-foreground' })}
      >
        <ChevronLeft data-icon="inline-start" /> Invités
      </Link>

      {created && <CreatedBanner order={order} eventId={eventId} />}

      <div className="mb-5 flex items-center gap-4">
        <PersonAvatar name={order.buyerName} className="size-16 text-xl" />
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl leading-tight font-semibold tracking-tight">
            {order.buyerName}
          </h1>
          <p className="truncate text-[15px] text-muted-foreground">{order.buyerEmail || order.buyerPhone}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {cancelled ? (
              <Badge variant="destructive">Annulée</Badge>
            ) : (
              <Badge variant={arrived === order.quantity ? 'success' : arrived ? 'warning' : 'secondary'}>
                {arrived === order.quantity ? 'Arrivé' : `${arrived}/${order.quantity} arrivés`}
              </Badge>
            )}
            <EmailStatusBadge status={order.emailStatus} />
          </div>
        </div>
      </div>

      {cancelled && (
        <Alert variant="destructive" className="mb-5">
          <Ban />
          <AlertTitle>Cette commande est annulée</AlertTitle>
          <AlertDescription>
            Ses billets sont refusés à l’entrée.{order.cancelReason && <> Motif : {order.cancelReason}</>}
          </AlertDescription>
        </Alert>
      )}

      {order.emailStatus === 'failed' && order.emailError && !created && (
        <Alert variant="destructive" className="mb-5">
          <TriangleAlert />
          <AlertTitle>Le dernier e-mail a échoué</AlertTitle>
          <AlertDescription className="break-words">{order.emailError}</AlertDescription>
        </Alert>
      )}

      <section className="mb-6">
        <SectionTitle>{plural(order.quantity, 'billet')}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {order.tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} eventId={eventId} orderCancelled={cancelled} />
          ))}
        </div>
      </section>

      <section className="mb-6">
        <SectionTitle>Paiement</SectionTitle>
        <Card size="sm">
          <CardContent>
            <dl className="divide-y">
              <Row label="Payé en espèces">{formatMoney(order.amount, order.currency)}</Row>
              <Row label="Vendu le">
                <LocalTime iso={order.createdAt} />
              </Row>
              <Row label="Commande">n° {order.id}</Row>
              {order.buyerPhone && <Row label="Téléphone">{order.buyerPhone}</Row>}
              {order.notes && <Row label="Notes">{order.notes}</Row>}
            </dl>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Actions</SectionTitle>
        <Button
          variant="outline"
          size="lg"
          className="justify-start"
          onClick={resend}
          disabled={cancelled || busy !== null}
        >
          {busy === 'email' ? <Spinner /> : <Mail />}
          {order.emailStatus === 'sent' ? 'Renvoyer les billets' : 'Envoyer les billets'}
        </Button>
        <EditGuestDrawer order={order} eventId={eventId} />
        <CancelOrder order={order} eventId={eventId} />
      </section>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-[15px]">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  )
}

function CreatedBanner({ order, eventId }: { order: OrderDetail; eventId: string }) {
  const failed = order.emailStatus === 'failed'
  return (
    <div className="mb-5 flex flex-col gap-3">
      <Alert>
        {failed ? <TriangleAlert className="text-destructive" /> : <CircleCheck className="text-emerald-600" />}
        <AlertTitle>Vente enregistrée : {formatMoney(order.amount, order.currency)} en espèces</AlertTitle>
        <AlertDescription className="break-words">
          {failed
            ? `L’e-mail à ${order.buyerEmail} a échoué : ${order.emailError} Réessayez ci-dessous.`
            : `Billets envoyés à ${order.buyerEmail}.`}
        </AlertDescription>
      </Alert>
      <Link to="/events/$eventId/sell" params={{ eventId }} className={buttonVariants({ size: 'lg' })}>
        Nouvelle vente
      </Link>
    </div>
  )
}

function TicketCard({
  ticket,
  eventId,
  orderCancelled,
}: {
  ticket: OrderTicket
  eventId: string
  orderCancelled: boolean
}) {
  const { busy, run } = useAction()
  const hydrated = useHydrated()
  const canShare = hydrated && 'share' in navigator
  const code = formatCode(ticket.code)

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground">
          {ticket.seq} sur {ticket.quantity}
        </CardTitle>
        <CardAction>
          {orderCancelled ? (
            <Badge variant="destructive">Annulé</Badge>
          ) : ticket.checkedInAt ? (
            <Badge variant="success">
              Arrivé à&nbsp;
              <LocalTime iso={ticket.checkedInAt} mode="time" />
            </Badge>
          ) : (
            <Badge variant="secondary">Pas arrivé</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2">
        <Dialog>
          <DialogTrigger
            aria-label="Afficher le QR code en plein écran"
            className="block w-48 rounded-2xl p-1 ring-1 ring-foreground/10 transition hover:ring-foreground/30"
          >
            <QrImage svg={ticket.qrSvg} label={`QR code du billet ${code}`} />
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
            <DialogTitle className="sr-only">Billet {code}</DialogTitle>
            <QrImage svg={ticket.qrSvg} label={`QR code du billet ${code}`} />
            <p className="text-center font-mono text-2xl font-semibold tracking-widest">{code}</p>
            <DialogDescription className="text-center">
              Scannez avec l’appareil photo de votre téléphone pour garder votre billet.
            </DialogDescription>
          </DialogContent>
        </Dialog>
        <p className="font-mono text-lg font-semibold tracking-widest">{code}</p>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2">
        {canShare ? (
          <Button
            variant="secondary"
            onClick={() => navigator.share({ title: 'Votre billet', url: ticket.url }).catch(() => {})}
          >
            <Share /> Partager
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(ticket.url).then(() => toast.success('Lien du billet copié.'))}
          >
            <Copy /> Copier le lien
          </Button>
        )}
        {!orderCancelled &&
          (ticket.checkedInAt ? (
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() =>
                run('undo', async () => {
                  await undoCheckInFn({ data: { eventId, ticketId: ticket.id } })
                  return 'Check-in annulé.'
                })
              }
            >
              <RotateCcw /> Annuler
            </Button>
          ) : (
            <Button
              disabled={busy !== null}
              onClick={() =>
                run('in', async () => {
                  await checkInTicketFn({ data: { eventId, ticketId: ticket.id } })
                  return 'Check-in fait.'
                })
              }
            >
              {busy === 'in' && <Spinner />} Check-in
            </Button>
          ))}
      </CardFooter>
    </Card>
  )
}

function EditGuestDrawer({ order, eventId }: { order: OrderDetail; eventId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    buyerPhone: order.buyerPhone,
    notes: order.notes,
  })
  const [pending, setPending] = useState(false)
  const emailChanged = form.buyerEmail.trim().toLowerCase() !== order.buyerEmail

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      await updateOrderFn({ data: { eventId, id: order.id, ...form } })
      await router.invalidate()
      setOpen(false)
      toast.success(emailChanged ? 'Enregistré. Renvoyez les billets à la nouvelle adresse.' : 'Enregistré.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={<Button variant="outline" size="lg" className="justify-start" />}>
        <Pencil /> Modifier les infos
      </DrawerTrigger>
      <DrawerContent>
        <form onSubmit={save} className="flex min-h-0 flex-col">
          <DrawerHeader>
            <DrawerTitle>Modifier les infos</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="edit-name">Nom</FieldLabel>
                <Input id="edit-name" required autoCapitalize="words" {...field('buyerName')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-email">E-mail</FieldLabel>
                <Input
                  id="edit-email"
                  type="email"
                  inputMode="email"
                  required
                  autoCapitalize="none"
                  {...field('buyerEmail')}
                />
                {emailChanged && (
                  <FieldDescription>Pensez à renvoyer les billets après l’enregistrement.</FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-phone">Téléphone</FieldLabel>
                <Input id="edit-phone" type="tel" inputMode="tel" {...field('buyerPhone')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-notes">Notes</FieldLabel>
                <Textarea id="edit-notes" rows={2} {...field('notes')} />
              </Field>
            </FieldGroup>
          </div>
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button type="submit" size="lg" disabled={pending}>
              {pending && <Spinner />} Enregistrer
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

function CancelOrder({ order, eventId }: { order: OrderDetail; eventId: string }) {
  const { busy, run } = useAction()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const total = formatMoney(order.amount, order.currency)

  if (order.cancelledAt) {
    return (
      <Button
        variant="outline"
        size="lg"
        className="justify-start"
        disabled={busy !== null}
        onClick={() =>
          run('reinstate', async () => {
            await setOrderCancelledFn({ data: { eventId, id: order.id, cancelled: false, reason: '' } })
            return 'Commande rétablie. Ses billets sont de nouveau valables.'
          })
        }
      >
        {busy === 'reinstate' ? <Spinner /> : <RotateCcw />} Rétablir la commande
      </Button>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="destructive" size="lg" className="justify-start" />}>
        <Ban /> Annuler et rembourser
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Annuler {plural(order.quantity, 'billet')} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Tous les billets de cette commande seront refusés à l’entrée. Rendez vous-même les {total} en espèces.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor="cancel-reason">Motif (facultatif)</FieldLabel>
          <Input
            id="cancel-reason"
            placeholder="ex. ne peut pas venir"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel>Garder</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={busy !== null}
            onClick={() =>
              run('cancel', async () => {
                await setOrderCancelledFn({ data: { eventId, id: order.id, cancelled: true, reason } })
                setOpen(false)
                return `Commande annulée. Remboursez ${total} à ${order.buyerName}.`
              })
            }
          >
            {busy === 'cancel' && <Spinner />} Annuler la commande
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
