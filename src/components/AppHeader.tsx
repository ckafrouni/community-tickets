import { Link, getRouteApi } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo } from './Logo'
import { Avatar, cx } from './ui'

const appRoute = getRouteApi('/_app')

export function AppHeader({
  back,
  title,
  subtitle,
  actions,
  children,
}: {
  back?: boolean
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  const { user } = appRoute.useRouteContext()
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-zinc-100/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2.5 px-4">
        {back ? (
          <Link
            to="/events"
            aria-label="All events"
            className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-900"
          >
            <ChevronLeft className="size-6" />
          </Link>
        ) : (
          <Link to="/events" aria-label="Events" className="shrink-0">
            <Logo className="size-8 rounded-lg ring-1 ring-black/5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-5 font-semibold">{title}</p>
          {subtitle && <p className="truncate text-xs leading-4 text-zinc-500">{subtitle}</p>}
        </div>
        {actions}
        <button
          type="button"
          popoverTarget="account"
          aria-label="Account"
          className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        >
          <Avatar name={user.name} size="sm" />
        </button>
      </div>
      {children}
    </header>
  )
}

export function Main({ tabBar, children }: { tabBar?: boolean; children: ReactNode }) {
  return (
    <main
      className={cx(
        'mx-auto max-w-3xl px-4 pt-5',
        tabBar ? 'pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12' : 'pb-12',
      )}
    >
      {children}
    </main>
  )
}
