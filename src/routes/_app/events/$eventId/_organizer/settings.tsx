import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { ChevronRight, Download, Mail, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader, SectionTitle } from '#/components/common'
import { EventForm } from '#/components/EventForm'
import { Button } from '#/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '#/components/ui/drawer'
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '#/components/ui/item'
import { Spinner } from '#/components/ui/spinner'
import { eventEmailInfoFn, sendTestEmailFn, updateEventFn } from '#/functions/events.functions'
import { errorMessage } from '#/lib/schemas'

export const Route = createFileRoute('/_app/events/$eventId/_organizer/settings')({
  loader: ({ params }) => eventEmailInfoFn({ data: { eventId: params.eventId } }),
  head: () => ({ meta: [{ title: 'Réglages' }] }),
  component: SettingsPage,
})

function SettingsPage() {
  const { event } = Route.useRouteContext()
  const { emailFrom } = Route.useLoaderData()
  const router = useRouter()
  const { id, ...details } = event

  return (
    <>
      <PageHeader title="Réglages" />

      <section className="mb-6">
        <SectionTitle>Gérer</SectionTitle>
        <ItemGroup className="gap-2">
          <Item
            variant="outline"
            className="bg-card"
            render={<Link to="/events/$eventId/team" params={{ eventId: id }} />}
          >
            <ItemMedia variant="icon">
              <Users />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Équipe</ItemTitle>
              <ItemDescription>Organisateurs et bénévoles</ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronRight className="size-4 text-muted-foreground" />
            </ItemActions>
          </Item>
          <Item variant="outline" className="bg-card" render={<a href={`/api/events/${id}/guests.csv`} />}>
            <ItemMedia variant="icon">
              <Download />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Exporter la liste des invités</ItemTitle>
              <ItemDescription>Fichier CSV pour Excel ou Google Sheets</ItemDescription>
            </ItemContent>
          </Item>
          <TestEmail eventId={id} emailFrom={emailFrom} />
        </ItemGroup>
      </section>

      <EventForm
        initial={details}
        submitLabel="Enregistrer"
        onSubmit={async (input) => {
          await updateEventFn({ data: { eventId: id, ...input } })
          await router.invalidate()
          return 'Enregistré.'
        }}
      />
    </>
  )
}

function TestEmail({ eventId, emailFrom }: { eventId: string; emailFrom: string }) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      await sendTestEmailFn({ data: { eventId, to } })
      setOpen(false)
      toast.success(`Envoyé à ${to}. Vérifiez la boîte de réception et les spams.`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Item variant="outline" className="bg-card">
        <ItemMedia variant="icon">
          <Mail />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle>E-mail de test</ItemTitle>
          <ItemDescription className="truncate">Les billets partent de {emailFrom}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <DrawerTrigger render={<Button variant="secondary" size="sm" />}>Envoyer</DrawerTrigger>
        </ItemActions>
      </Item>
      <DrawerContent>
        <form onSubmit={onSubmit} className="flex flex-col">
          <DrawerHeader>
            <DrawerTitle>Envoyer un e-mail de test</DrawerTitle>
            <DrawerDescription>Vérifiez que les billets arrivent bien dans les boîtes mail.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <Field>
              <FieldLabel htmlFor="test-email-to">Destinataire</FieldLabel>
              <Input
                id="test-email-to"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                required
                placeholder="vous@exemple.fr"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button type="submit" size="lg" disabled={pending}>
              {pending && <Spinner />} Envoyer le test
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
