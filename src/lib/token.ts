// Ticket tokens look like `<ticketId>.<signature>` (22 + 43 base64url chars).
// QR codes contain the full ticket URL (`https://host/t/<token>`) so that a
// regular phone camera opens the ticket page, while the door scanner only
// needs the token part. Signature checks happen on the server.

const TOKEN_RE = /^[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/

export function isTokenShape(value: string): boolean {
  return TOKEN_RE.test(value)
}

export function extractToken(scanned: string): string | null {
  const text = scanned.trim()
  if (isTokenShape(text)) return text
  try {
    const url = new URL(text)
    const match = /\/t\/([^/?#]+)\/?$/.exec(url.pathname)
    if (match) {
      const token = decodeURIComponent(match[1])
      return isTokenShape(token) ? token : null
    }
  } catch {
    // not a URL
  }
  return null
}
