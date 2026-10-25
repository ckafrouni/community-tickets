import { useHydrated } from '@tanstack/react-router'
import type { ComponentProps, ReactNode } from 'react'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { FieldSet } from '#/components/ui/field'
import { formatDateTime, formatTime, timeAgo, type EventWhen } from '#/lib/format'
import type { EmailStatus } from '#/lib/types'
import { cn } from '#/lib/utils'

export function Form({ className, children, ...props }: ComponentProps<'form'>) {
  const hydrated = useHydrated()
  return (
    <form {...props}>
      <FieldSet disabled={!hydrated} className={className}>
        {children}
      </FieldSet>
    </form>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-heading text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</h2>
}

export function StickyBar({ aboveTabBar, children }: { aboveTabBar?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'sticky z-20 -mx-4 flex flex-col gap-3 bg-linear-to-t from-background from-70% to-background/0 px-4 pt-6',
        aboveTabBar
          ? 'bottom-[calc(4rem+env(safe-area-inset-bottom))] pb-3 md:bottom-0 md:pb-4'
          : 'bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
      )}
    >
      {children}
    </div>
  )
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = Array.from(words[0])[0]
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : ''
  return (first + last).toUpperCase()
}

function hashString(value: string): number {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.codePointAt(0)!) | 0
  return Math.abs(hash)
}

const AVATAR_TONES = [
  'bg-rose-100 text-rose-700',
  'bg-orange-100 text-orange-700',
  'bg-amber-100 text-amber-800',
  'bg-lime-100 text-lime-800',
  'bg-emerald-100 text-emerald-700',
  'bg-teal-100 text-teal-700',
  'bg-sky-100 text-sky-700',
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-fuchsia-100 text-fuchsia-700',
]

const toneFor = (name: string, tones: string[]) => tones[hashString(name.trim().toLowerCase()) % tones.length]

export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar size="lg" className={className} aria-hidden="true">
      <AvatarFallback className={cn('font-semibold', toneFor(name, AVATAR_TONES))}>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}

const COVERS = [
  'from-rose-400 to-orange-300',
  'from-violet-500 to-fuchsia-400',
  'from-sky-500 to-cyan-300',
  'from-emerald-500 to-lime-300',
  'from-amber-400 to-pink-400',
  'from-indigo-500 to-sky-400',
  'from-fuchsia-500 to-rose-300',
  'from-teal-500 to-emerald-300',
]

export function EventCover({ name, className }: { name: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center bg-linear-to-br font-heading font-semibold text-white/95',
        toneFor(name, COVERS),
        className,
      )}
    >
      {initials(name)}
    </div>
  )
}

export function DateTile({ when }: { when: EventWhen }) {
  return (
    <div className="w-12 shrink-0 overflow-hidden rounded-xl bg-card text-center ring-1 ring-foreground/10">
      <div className="bg-muted py-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground">{when.month}</div>
      <div className="py-1 text-lg leading-6 font-semibold">{when.day}</div>
    </div>
  )
}

export function IconTile({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-card text-muted-foreground ring-1 ring-foreground/10 [&>svg]:size-5">
      {children}
    </div>
  )
}

export function LocalTime({ iso, mode = 'datetime' }: { iso: string; mode?: 'datetime' | 'time' | 'ago' }) {
  const hydrated = useHydrated()
  if (!hydrated) return <time dateTime={iso} />
  const text = mode === 'time' ? formatTime(iso) : mode === 'ago' ? timeAgo(iso) : formatDateTime(iso)
  return (
    <time dateTime={iso} title={formatDateTime(iso)}>
      {text}
    </time>
  )
}

export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  switch (status) {
    case 'sent':
      return <Badge variant="success">E-mail envoyé</Badge>
    case 'failed':
      return <Badge variant="destructive">Échec de l’e-mail</Badge>
    default:
      return <Badge variant="secondary">E-mail non envoyé</Badge>
  }
}

export function QrImage({ svg, label, className }: { svg: string; label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('aspect-square w-full [&>svg]:h-full [&>svg]:w-full', className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
