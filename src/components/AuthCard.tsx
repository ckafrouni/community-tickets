import type { ReactNode } from 'react'
import { Logo } from './Logo'
import { Card } from './ui'

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo className="mx-auto mb-3 size-14 rounded-2xl shadow-sm" />
          <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">Community Tickets</p>
          <h1 className="mt-1 text-xl font-bold">{title}</h1>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
        <Card>{children}</Card>
      </div>
    </div>
  )
}
