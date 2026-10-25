// Ticket security model
// ---------------------
// Every ticket has a random 128-bit id. The QR code carries `<id>.<sig>`, where
// sig is an HMAC-SHA256 of the id under TICKET_SECRET, a Worker secret that
// never leaves Cloudflare. A ticket is only accepted when (1) the signature
// verifies, (2) the id exists in D1, (3) its order is not cancelled, and (4) it
// has not been checked in yet. Guessing a valid id+signature is computationally
// infeasible, and copying a real QR code only works once because check-in is a
// single conditional UPDATE.

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

/** 8-character human-readable code (40 bits) for manual lookup at the door. */
export function randomCode(length = 8): string {
  // 256 is a multiple of 32, so `byte & 31` is uniformly distributed.
  return Array.from(randomBytes(length), (b) => CROCKFORD[b & 31]).join('')
}

/** 256 random bits, base64url-encoded. */
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

/** Returns the ticket id if the token's signature is valid, otherwise null. */
export async function verifyTicketToken(secret: string, token: string): Promise<string | null> {
  const match = /^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(token)
  if (!match) return null
  const [, ticketId, encoded] = match
  const signature = fromBase64url(encoded)
  // The last base64url character carries unused bits; only accept the canonical spelling.
  if (base64url(signature) !== encoded) return null
  // subtle.verify compares in constant time.
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), signature, ticketMessage(ticketId))
  return valid ? ticketId : null
}
