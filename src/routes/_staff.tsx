import { Link, Outlet, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { Logo } from '#/components/Logo'
import { Button } from '#/components/ui'
import { getSessionFn } from '#/functions/auth.functions'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/_staff')({
  beforeLoad: async ({ location }) => {
    const session = await getSessionFn()
    if (!session) throw redirect({ to: '/login', search: { redirect: location.href } })
    return { session }
  },
  component: StaffLayout,
})

const ADMIN_NAV = [
  { to: '/sell', label: 'Sell' },
  { to: '/orders', label: 'Orders' },
  { to: '/door', label: 'Door' },
  { to: '/staff', label: 'Staff' },
  { to: '/settings', label: 'Settings' },
] as const

function StaffLayout() {
  const { session } = Route.useRouteContext()
  const router = useRouter()
  const nav = session.role === 'admin' ? ADMIN_NAV : ([{ to: '/door', label: 'Door' }] as const)

  async function signOut() {
    await authClient.signOut()
    await router.invalidate()
    await router.navigate({ to: '/login' })
  }

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pt-3">
          <Logo className="size-8 rounded-lg ring-1 ring-slate-200" />
          <p className="min-w-0 flex-1 truncate font-semibold">{session.eventName}</p>
          <span className="hidden text-xs text-slate-500 sm:inline">
            {session.name} · {session.role === 'admin' ? 'organizer' : 'door staff'}
          </span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 sm:px-4" aria-label="Main">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="border-b-2 border-transparent px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-slate-600 hover:text-slate-900"
              activeProps={{ className: '!border-indigo-600 !text-indigo-700' }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
