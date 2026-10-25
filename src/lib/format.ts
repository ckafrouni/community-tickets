// Formatting helpers that are safe to use on both server and client.
// A fixed locale keeps server-rendered and hydrated output identical.

const LOCALE = 'en'

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

/** Format an amount stored in minor units (e.g. cents). */
export function formatMoney(minor: number, currency: string): string {
  const digits = currencyDigits(currency)
  const major = minor / 10 ** digits
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(major)
  } catch {
    return `${major.toFixed(digits)} ${currency}`
  }
}

/** Convert minor units to the plain decimal string used in form inputs. */
export function minorToInput(minor: number, currency: string): string {
  const digits = currencyDigits(currency)
  return (minor / 10 ** digits).toFixed(digits)
}

/** Parse a user-typed amount ("12", "12.5", "12,50") into minor units. */
export function inputToMinor(input: string, currency: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  const digits = currencyDigits(currency)
  return Math.round(Number(cleaned) * 10 ** digits)
}

/** Crockford base32 code stored without separator, displayed as XXXX-XXXX. */
export function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
}

/** Normalize a hand-typed ticket code (tolerates dashes, spaces, O/0 and I/L/1 mixups). */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralForm}`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' })
}

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${plural(hours, 'hour')} ago`
  return `${plural(Math.round(hours / 24), 'day')} ago`
}
