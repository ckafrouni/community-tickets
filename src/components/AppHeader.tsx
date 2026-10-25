import { Link, getRouteApi, useRouter } from '@tanstack/react-router'
import { ChevronLeft, LogOut } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button, buttonVariants } from '#/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '#/components/ui/drawer'
import { Spinner } from '#/components/ui/spinner'
import { authClient } from '#/lib/auth-client'
import { cn } from '#/lib/utils'
import { Logo } from './Logo'
import { PersonAvatar } from './common'

const appRoute = getRouteApi('/_app')

export function AppHeader({
  back,
  title,
  subtitle,
  children,
}: {
  back?: boolean
  title: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2.5 px-4">
        {back ? (
          <Link
            to="/events"
            aria-label="All events"
            className={buttonVariants({ variant: 'ghost', size: 'icon-lg', className: '-ml-2.5' })}
          >
            <ChevronLeft className="size-6" />
          </Link>
        ) : (
          <Link to="/events" aria-label="Events" className="shrink-0">
            <Logo className="size-8 rounded-lg ring-1 ring-foreground/10" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-5 font-semibold">{title}</p>
          {subtitle && <p className="truncate text-xs leading-4 text-muted-foreground">{subtitle}</p>}
        </div>
        <AccountMenu />
      </div>
      {children}
    </header>
  )
}

function AccountMenu() {
  const { user } = appRoute.useRouteContext()
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    await authClient.signOut()
    await router.invalidate()
    await router.navigate({ to: '/login' })
  }

  return (
    <Drawer>
      <DrawerTrigger
        aria-label="Account"
        className="shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <PersonAvatar name={user.name} className="size-9" />
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="flex-row items-center gap-4 text-left">
          <PersonAvatar name={user.name} className="size-14 text-lg" />
          <div className="min-w-0">
            <DrawerTitle className="truncate text-lg">{user.name}</DrawerTitle>
            <DrawerDescription className="truncate">{user.email}</DrawerDescription>
            {user.isAdmin && (
              <Badge variant="secondary" className="mt-1.5">
                Platform admin
              </Badge>
            )}
          </div>
        </DrawerHeader>
        <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button variant="secondary" size="lg" disabled={pending} onClick={signOut}>
            {pending ? <Spinner /> : <LogOut />} Sign out
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export function Main({ tabBar, children }: { tabBar?: boolean; children: ReactNode }) {
  return (
    <main
      className={cn(
        'mx-auto max-w-3xl px-4 pt-5',
        tabBar ? 'pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12' : 'pb-12',
      )}
    >
      {children}
    </main>
  )
}
