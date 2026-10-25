import type { ReactNode } from 'react'
import { Logo } from './Logo'
import { Card } from './ui'

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-sm">
        <Logo className="mb-6 size-14 rounded-2xl shadow-sm ring-1 ring-black/5" />
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-zinc-500">{subtitle}</p>}
        <Card className="mt-6 p-5">{children}</Card>
        {footer && <div className="mt-5 space-y-2 text-center text-[15px] text-zinc-500">{footer}</div>}
      </div>
    </div>
  )
}

export const authLinkClass = 'font-semibold text-zinc-900 hover:underline'
