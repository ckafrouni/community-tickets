import { useHydrated } from '@tanstack/react-router'
import { CircleCheck, CircleX, Info, Search, TriangleAlert } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { formatDateTime, formatTime, timeAgo, type EventWhen } from '#/lib/format'
import type { EmailStatus } from '#/lib/types'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'danger' | 'ghost' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-800 active:bg-black',
  secondary: 'bg-white text-zinc-900 ring-1 ring-zinc-200 ring-inset hover:bg-zinc-50 active:bg-zinc-100',
  soft: 'bg-zinc-200/70 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200',
  ghost: 'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 active:bg-zinc-200',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-11 gap-1.5 rounded-xl px-3.5 text-sm',
  md: 'h-11 gap-2 rounded-xl px-4 text-[15px]',
  lg: 'h-13 gap-2 rounded-xl px-5 text-base',
  icon: 'size-11 rounded-full',
}

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cx(
    'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:pointer-events-none disabled:opacity-40',
    buttonSizes[size],
    buttonVariants[variant],
    className,
  )
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type="button" {...props} className={buttonClass(variant, size, className)} />
}

export function Form({ className, children, ...props }: ComponentProps<'form'>) {
  const hydrated = useHydrated()
  return (
    <form {...props}>
      <fieldset disabled={!hydrated} className={cx('m-0 min-w-0 border-0 p-0', className)}>
        {children}
      </fieldset>
    </form>
  )
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cx('rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/6', className)}
    />
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex min-h-6 items-center justify-between gap-3 px-1">
      <h2 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">{children}</h2>
      {action}
    </div>
  )
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
      <span className="mb-1.5 block text-sm font-medium text-zinc-600">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[13px] text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[13px] text-zinc-500">{hint}</span>
      ) : null}
    </label>
  )
}

const inputBase =
  'block w-full rounded-xl bg-white px-3.5 text-base text-zinc-900 ring-1 ring-zinc-200 ring-inset placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-500'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input {...props} className={cx(inputBase, 'h-12', className)} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea rows={3} {...props} className={cx(inputBase, 'py-3', className)} />
}

export function SearchInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-zinc-400" />
      <input
        type="search"
        autoComplete="off"
        autoCapitalize="none"
        {...props}
        className={cx(inputBase, 'h-11 rounded-full pl-11 shadow-[0_1px_2px_rgba(0,0,0,0.04)]')}
      />
    </div>
  )
}

export function Switch({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description?: ReactNode
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 has-disabled:cursor-not-allowed">
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-zinc-900">{label}</span>
        {description && <span className="block text-[13px] text-zinc-500">{description}</span>}
      </span>
      <span className="relative inline-flex h-7 w-12 shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="absolute inset-0 rounded-full bg-zinc-300 transition peer-checked:bg-zinc-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-zinc-900 peer-disabled:opacity-40" />
        <span className="absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'dark'

const pillTones: Record<Tone, string> = {
  neutral: 'bg-zinc-100 text-zinc-600',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-600',
  dark: 'bg-zinc-900 text-white',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        pillTones[tone],
      )}
    >
      {children}
    </span>
  )
}

const alertTones: Record<Exclude<Tone, 'dark'>, { box: string; icon: ReactNode }> = {
  neutral: { box: 'bg-white text-zinc-700 ring-1 ring-black/6', icon: <Info className="text-zinc-400" /> },
  green: { box: 'bg-emerald-50 text-emerald-900', icon: <CircleCheck className="text-emerald-600" /> },
  amber: { box: 'bg-amber-50 text-amber-900', icon: <TriangleAlert className="text-amber-600" /> },
  red: { box: 'bg-red-50 text-red-900', icon: <CircleX className="text-red-600" /> },
}

export function Alert({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: Exclude<Tone, 'dark'>
  title?: ReactNode
  children?: ReactNode
}) {
  const { box, icon } = alertTones[tone]
  return (
    <div role={tone === 'red' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-2xl p-4 text-sm', box)}>
      <span className="mt-px shrink-0 [&>svg]:size-5">{icon}</span>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : undefined}>{children}</div>}
      </div>
    </div>
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
        <h1 className="text-[28px] leading-tight font-bold tracking-tight text-zinc-900">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export const backLinkClass =
  'mb-2 -ml-1.5 inline-flex h-9 items-center gap-0.5 pr-2 text-[15px] font-medium text-zinc-500 hover:text-zinc-900'

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-zinc-200/70 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cx(
            'h-9 rounded-full px-4 text-sm font-semibold transition',
            option.value === value ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function StickyBar({ aboveTabBar, children }: { aboveTabBar?: boolean; children: ReactNode }) {
  return (
    <div
      className={cx(
        'sticky z-20 -mx-4 space-y-3 bg-linear-to-t from-zinc-100 from-70% to-zinc-100/0 px-4 pt-6',
        aboveTabBar
          ? 'bottom-[calc(4rem+env(safe-area-inset-bottom))] pb-3 md:bottom-0 md:pb-4'
          : 'bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
      )}
    >
      {children}
    </div>
  )
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

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = Array.from(words[0])[0]
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : ''
  return (first + last).toUpperCase()
}

export function hashString(value: string): number {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.codePointAt(0)!) | 0
  return Math.abs(hash)
}

const avatarSizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-16 text-xl' }

export function Avatar({ name, size = 'md' }: { name: string; size?: keyof typeof avatarSizes }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        avatarSizes[size],
        AVATAR_TONES[hashString(name.trim().toLowerCase()) % AVATAR_TONES.length],
      )}
    >
      {initials(name)}
    </span>
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
      className={cx(
        'flex shrink-0 items-center justify-center bg-linear-to-br font-bold text-white/95',
        COVERS[hashString(name.trim().toLowerCase()) % COVERS.length],
        className,
      )}
    >
      {initials(name)}
    </div>
  )
}

export function List({ className, ...props }: ComponentProps<'ul'>) {
  return (
    <ul
      {...props}
      className={cx(
        'divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/6',
        className,
      )}
    />
  )
}

export const rowClass = 'flex min-h-16 items-center gap-3 px-4 py-3'
export const interactiveRowClass = cx(rowClass, 'transition hover:bg-zinc-50 active:bg-zinc-100')

export function DateTile({ when }: { when: EventWhen }) {
  return (
    <div className="w-12 shrink-0 overflow-hidden rounded-xl bg-white text-center ring-1 ring-black/10">
      <div className="bg-zinc-100 py-0.5 text-[10px] font-bold tracking-wider text-zinc-500">{when.month}</div>
      <div className="py-1 text-lg leading-6 font-semibold text-zinc-900">{when.day}</div>
    </div>
  )
}

export function IconTile({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-500 ring-1 ring-black/10 [&>svg]:size-5">
      {children}
    </div>
  )
}

export function Sheet({
  id,
  title,
  className,
  children,
}: {
  id: string
  title?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div
      id={id}
      popover="auto"
      className={cx(
        'fixed inset-x-0 top-auto bottom-0 mx-auto my-0 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-0 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl backdrop:bg-black/40 md:top-0 md:my-auto md:rounded-3xl',
        className,
      )}
    >
      <div className="mx-auto -mt-1 mb-4 h-1.5 w-10 rounded-full bg-zinc-200 md:hidden" aria-hidden="true" />
      {title && <h2 className="mb-4 text-xl font-bold tracking-tight">{title}</h2>}
      {children}
    </div>
  )
}

export function closeSheet(id: string) {
  document.getElementById(id)?.hidePopover()
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-black/6">
      <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 [&>svg]:size-6">
        {icon}
      </div>
      <p className="font-semibold text-zinc-900">{title}</p>
      {children && <div className="text-sm text-zinc-500">{children}</div>}
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
