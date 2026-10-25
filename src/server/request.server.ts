import { getRequest, getRequestHeader } from '@tanstack/react-start/server'

// On Cloudflare the request URL reflects the hostname the visitor used, and the
// Worker only serves its custom domain, so the request origin is trustworthy.

/** Origin used to build absolute ticket links. */
export function getBaseUrl(): string {
  return new URL(getRequest().url).origin
}

export function isSecureRequest(): boolean {
  return new URL(getRequest().url).protocol === 'https:'
}

/** Set by Cloudflare's edge; absent only in local development. */
export function getClientIp(): string {
  return getRequestHeader('cf-connecting-ip') ?? 'local'
}
