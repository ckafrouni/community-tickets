import { useHydrated } from '@tanstack/react-router'
import type { ComponentProps, ReactNode } from 'react'
import { formatDateTime, formatTime, timeAgo } from '#/lib/format'
import type { EmailStatus } from '#/lib/types'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm',
  secondary: 'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 shadow-sm',
  danger: 'bg-white text-red-700 ring-1 ring-red-300 hover:bg-red-50',
  ghost: 'text-slate-700 hover:bg-slate-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'px-2.5 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-5 py-3.5 text-base',
        buttonVariants[variant],
        className,
      )}
    />
  )
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cx('rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6', className)} />
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-sm text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-sm text-slate-500">{hint}</span>
      ) : null}
    </label>
  )
}

const inputClass =
  'block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 focus:outline-none disabled:bg-slate-50'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input {...props} className={cx(inputClass, className)} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea rows={3} {...props} className={cx(inputClass, className)} />
}

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'indigo'

const badgeTones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        badgeTones[tone],
      )}
    >
      {children}
    </span>
  )
}

const alertTones: Record<Tone, string> = {
  neutral: 'bg-slate-50 text-slate-800 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  red: 'bg-red-50 text-red-900 ring-red-200',
  indigo: 'bg-indigo-50 text-indigo-900 ring-indigo-200',
}

export function Alert({ tone = 'neutral', title, children }: { tone?: Tone; title?: ReactNode; children?: ReactNode }) {
  return (
    <div role={tone === 'red' ? 'alert' : 'status'} className={cx('rounded-lg p-4 text-sm ring-1', alertTones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : undefined}>{children}</div>}
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="!p-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </Card>
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Renders times in the viewer's timezone; empty during SSR to avoid hydration mismatches. */
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
      return <Badge tone="green">Emailed</Badge>
    case 'failed':
      return <Badge tone="red">Email failed</Badge>
    default:
      return <Badge>Not emailed</Badge>
  }
}

export function QrImage({ svg, label, className }: { svg: string; label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cx('aspect-square w-full [&>svg]:h-full [&>svg]:w-full', className)}
      // SVG markup is generated on our server by the qrcode library.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('size-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
