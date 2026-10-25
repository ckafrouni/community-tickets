import type { ReactNode } from 'react'
import { Card, CardContent } from '#/components/ui/card'
import { Logo } from './Logo'

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-sm">
        <Logo className="mb-6 size-14 rounded-2xl shadow-sm ring-1 ring-foreground/10" />
        <h1 className="font-heading text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted-foreground">{subtitle}</p>}
        {children && (
          <Card className="mt-6">
            <CardContent>{children}</CardContent>
          </Card>
        )}
        {footer && (
          <div className="mt-5 flex flex-col gap-2 text-center text-[15px] text-muted-foreground">{footer}</div>
        )}
      </div>
    </div>
  )
}

export const authLinkClass = 'font-medium text-foreground underline-offset-4 hover:underline'
