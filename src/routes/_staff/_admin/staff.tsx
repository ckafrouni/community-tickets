import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Alert, Badge, Button, Card, Field, Input, LocalTime, PageHeader, Spinner } from '#/components/ui'
import { addStaffFn, listStaffFn, removeStaffFn, sendPasswordLinkFn } from '#/functions/staff.functions'
import { errorMessage } from '#/lib/schemas'

export const Route = createFileRoute('/_staff/_admin/staff')({
  loader: () => listStaffFn(),
  head: () => ({ meta: [{ title: 'Staff' }] }),
  component: StaffPage,
})

type Message = { tone: 'green' | 'red'; text: string }

function StaffPage() {
  const { staff, currentUserId } = Route.useLoaderData()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<Message>()

  async function run(id: string, fn: () => Promise<unknown>, success: string) {
    setBusyId(id)
    setMessage(undefined)
    try {
      await fn()
      await router.invalidate()
      setMessage({ tone: 'green', text: success })
    } catch (e) {
      setMessage({ tone: 'red', text: errorMessage(e) })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Staff"
        description="People who can sign in. Door staff can only scan tickets; organizers can do everything."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="!p-0">
          <ul className="divide-y divide-slate-100">
            {staff.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {member.name}
                    {member.id === currentUserId && <span className="font-normal text-slate-500"> (you)</span>}
                  </span>
                  <span className="block truncate text-sm text-slate-500">{member.email}</span>
                  <span className="block text-xs text-slate-400">
                    Added <LocalTime iso={member.createdAt} />
                  </span>
                </span>
                <Badge tone={member.role === 'admin' ? 'indigo' : 'neutral'}>
                  {member.role === 'admin' ? 'Organizer' : 'Door staff'}
                </Badge>
                <span className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId !== null}
                    onClick={() =>
                      run(
                        member.id,
                        () => sendPasswordLinkFn({ data: { email: member.email } }),
                        `Sent a password link to ${member.email}.`,
                      )
                    }
                  >
                    {busyId === member.id && <Spinner />} Send password link
                  </Button>
                  {member.id !== currentUserId && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busyId !== null}
                      onClick={() => {
                        if (!confirm(`Remove ${member.name}? They will be signed out immediately.`)) return
                        void run(
                          member.id,
                          () => removeStaffFn({ data: { userId: member.id } }),
                          `Removed ${member.name}.`,
                        )
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-4">
          {message && <Alert tone={message.tone}>{message.text}</Alert>}
          <AddStaffCard
            onAdded={(email) =>
              setMessage({ tone: 'green', text: `Invited ${email}. They'll get an email to set a password.` })
            }
          />
        </div>
      </div>
    </>
  )
}

function AddStaffCard({ onAdded }: { onAdded: (email: string) => void }) {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', role: 'door' as 'door' | 'admin' })
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(undefined)
    try {
      await addStaffFn({ data: form })
      onAdded(form.email)
      setForm({ name: '', email: '', role: 'door' })
      await router.invalidate()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4">
        <h2 className="font-semibold">Add someone</h2>
        <Field label="Name">
          <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            autoCapitalize="none"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </Field>
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1.5 font-medium text-slate-700">Access</legend>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="role"
              className="mt-0.5 accent-indigo-600"
              checked={form.role === 'door'}
              onChange={() => setForm((f) => ({ ...f, role: 'door' }))}
            />
            <span>
              <span className="font-medium">Door staff</span>
              <span className="block text-slate-500">Scan and check in tickets only.</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="role"
              className="mt-0.5 accent-indigo-600"
              checked={form.role === 'admin'}
              onChange={() => setForm((f) => ({ ...f, role: 'admin' }))}
            />
            <span>
              <span className="font-medium">Organizer</span>
              <span className="block text-slate-500">Sell tickets, see buyers, manage staff and settings.</span>
            </span>
          </label>
        </fieldset>
        {error && <Alert tone="red">{error}</Alert>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Spinner />} Add &amp; email a password link
        </Button>
      </form>
    </Card>
  )
}
