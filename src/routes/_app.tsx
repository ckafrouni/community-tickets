import { Outlet, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Badge, Button, Sheet, Spinner } from '#/components/ui'
import { getSessionFn } from '#/functions/auth.functions'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const user = await getSessionFn()
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
    return { user }
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    await authClient.signOut()
    await router.invalidate()
    await router.navigate({ to: '/login' })
  }

  return (
    <div className="min-h-dvh">
      <Outlet />
      <Sheet id="account">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{user.name}</p>
            <p className="truncate text-sm text-zinc-500">{user.email}</p>
            {user.isAdmin && (
              <div className="mt-1.5">
                <Badge>Platform admin</Badge>
              </div>
            )}
          </div>
        </div>
        <Button variant="soft" size="lg" className="mt-6 w-full" disabled={pending} onClick={signOut}>
          {pending ? <Spinner /> : <LogOut className="size-5" />} Sign out
        </Button>
      </Sheet>
    </div>
  )
}
