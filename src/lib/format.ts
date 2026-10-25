export const LOCALE = 'fr-FR'
export const TIME_ZONE = 'Europe/Paris'

export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

export function isValidCurrency(currency: string): boolean {
  try {
    new Intl.NumberFormat(LOCALE, { style: 'currency', currency })
    return /^[A-Z]{3}$/.test(currency)
  } catch {
    return false
  }
}

export function formatMoney(minor: number, currency: string): string {
  const digits = currencyDigits(currency)
  const major = minor / 10 ** digits
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(major)
  } catch {
    return `${major.toFixed(digits)} ${currency}`
  }
}

export function currencySymbol(currency: string): string {
  try {
    return (
      new Intl.NumberFormat(LOCALE, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? currency
    )
  } catch {
    return currency
  }
}

export function minorToInput(minor: number, currency: string): string {
  const digits = currencyDigits(currency)
  return (minor / 10 ** digits).toFixed(digits).replace('.', ',')
}

export function inputToMinor(input: string, currency: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  const digits = currencyDigits(currency)
  return Math.round(Number(cleaned) * 10 ** digits)
}

export function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
}

export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`) {
  return `${n} ${Math.abs(n) < 2 ? singular : pluralForm}`
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export type EventWhen = { month: string; day: string; date: string; time: string }

export function parseEventDate(value: string): EventWhen | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute))
  if (date.getUTCMonth() !== month - 1) return null
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', ...options }).format(date)
  return {
    month: format({ month: 'short' }).replace('.', '').toUpperCase(),
    day: format({ day: 'numeric' }),
    date: capitalize(format({ weekday: 'long', month: 'long', day: 'numeric' })),
    time: format({ hour: '2-digit', minute: '2-digit' }),
  }
}

export function describeEventDate(value: string): string {
  const when = parseEventDate(value)
  return when ? `${when.date} · ${when.time}` : value
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { timeStyle: 'short' })
}

export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { dateStyle: 'long', timeZone: TIME_ZONE })
}

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto', style: 'short' })

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'à l’instant'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return relative.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour')
  return relative.format(-Math.round(hours / 24), 'day')
}
