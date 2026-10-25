const encoder = new TextEncoder()
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function base64url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length))
}

export function randomTicketId(): string {
  return base64url(randomBytes(16))
}

export function randomCode(length = 8): string {
  return Array.from(randomBytes(length), (b) => CROCKFORD[b & 31]).join('')
}

export function randomEventId(): string {
  return randomCode(12).toLowerCase()
}

export function randomToken(): string {
  return base64url(randomBytes(32))
}

const keys = new Map<string, Promise<CryptoKey>>()

function hmacKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error('TICKET_SECRET must be at least 32 characters long')
  let key = keys.get(secret)
  if (!key) {
    key = crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
      'verify',
    ])
    keys.set(secret, key)
  }
  return key
}

function ticketMessage(ticketId: string) {
  return encoder.encode(`ticket:v1:${ticketId}`)
}

export async function signTicket(secret: string, ticketId: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), ticketMessage(ticketId))
  return `${ticketId}.${base64url(new Uint8Array(signature))}`
}

export async function verifyTicketToken(secret: string, token: string): Promise<string | null> {
  const match = /^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(token)
  if (!match) return null
  const [, ticketId, encoded] = match
  const signature = fromBase64url(encoded)
  // Rejects non-canonical encodings: the last base64url character has unused bits.
  if (base64url(signature) !== encoded) return null
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), signature, ticketMessage(ticketId))
  return valid ? ticketId : null
}
