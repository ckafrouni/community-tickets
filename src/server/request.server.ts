import { getRequest, getRequestHeader } from '@tanstack/react-start/server'

export function getBaseUrl(): string {
  return new URL(getRequest().url).origin
}

export function isSecureRequest(): boolean {
  return new URL(getRequest().url).protocol === 'https:'
}

export function getClientIp(): string {
  return getRequestHeader('cf-connecting-ip') ?? 'local'
}
