import { env } from 'cloudflare:workers'
import { describe, expect, it, vi } from 'vite-plus/test'
import { formatMoney, inputToMinor, normalizeCode } from '#/lib/format'
import type { SaleInput } from '#/lib/schemas'
import { extractToken } from '#/lib/token'
import { randomCode, randomTicketId, signTicket, verifyTicketToken } from '#/server/crypto.server'
import { qrPng } from '#/server/qr.server'
import * as repo from '#/server/repo.server'

const secret = 'test-only-secret-that-is-long-enough-123456'

describe('ticket tokens', () => {
  it('verifies a token it signed', async () => {
    const id = randomTicketId()
    expect(await verifyTicketToken(secret, await signTicket(secret, id))).toBe(id)
  })

  it('rejects a tampered signature', async () => {
    const token = await signTicket(secret, randomTicketId())
    const last = token.at(-1) === 'A' ? 'B' : 'A'
    expect(await verifyTicketToken(secret, token.slice(0, -1) + last)).toBeNull()
  })

  it('rejects a signature moved onto a different ticket id', async () => {
    const [, signature] = (await signTicket(secret, randomTicketId())).split('.')
    expect(await verifyTicketToken(secret, `${randomTicketId()}.${signature}`)).toBeNull()
  })

  it('rejects tokens signed with another secret', async () => {
    const token = await signTicket('another-secret-that-is-also-long-enough-99', randomTicketId())
    expect(await verifyTicketToken(secret, token)).toBeNull()
  })

  it('rejects malformed input', async () => {
    for (const bad of ['', 'abc', 'a.b', `${randomTicketId()}.`, `${randomTicketId()}.${'x'.repeat(44)}`]) {
      expect(await verifyTicketToken(secret, bad)).toBeNull()
    }
  })

  it('refuses short secrets', async () => {
    await expect(signTicket('too-short', randomTicketId())).rejects.toThrow(/at least 32/)
  })

  it('generates human codes from the Crockford alphabet', () => {
    for (let i = 0; i < 200; i++) expect(randomCode()).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/)
  })
})

describe('extractToken', () => {
  it('reads the token from a ticket URL or a bare token', async () => {
    const token = await signTicket(secret, randomTicketId())
    expect(extractToken(`https://tickets.example.org/t/${token}`)).toBe(token)
    expect(extractToken(`http://localhost:3000/t/${token}/`)).toBe(token)
    expect(extractToken(`  ${token} `)).toBe(token)
  })

  it('ignores unrelated QR codes', () => {
    expect(extractToken('https://example.com/menu')).toBeNull()
    expect(extractToken('WIFI:S:hall;T:WPA;P:secret;;')).toBeNull()
  })
})

describe('formatting helpers', () => {
  it('normalizes hand-typed codes', () => {
    expect(normalizeCode('k7qm-2xpo')).toBe('K7QM2XP0')
    expect(normalizeCode('ab1l i')).toBe('AB111')
  })

  it('parses cash amounts into minor units', () => {
    expect(inputToMinor('12', 'USD')).toBe(1200)
    expect(inputToMinor('12,5', 'EUR')).toBe(1250)
    expect(inputToMinor('500', 'JPY')).toBe(500)
    expect(inputToMinor('abc', 'USD')).toBeNull()
    expect(formatMoney(1250, 'USD')).toBe('$12.50')
  })
})

describe('QR PNG encoder', () => {
  it('produces a valid PNG', async () => {
    const png = await qrPng('https://tickets.example.org/t/abc', 4)
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const view = new DataView(png.buffer, png.byteOffset)
    expect(new TextDecoder().decode(png.subarray(12, 16))).toBe('IHDR')
    expect(view.getUint32(16)).toBe(view.getUint32(20)) // square
  })
})

const sale: SaleInput = {
  buyerName: 'Jane Doe',
  buyerEmail: 'jane@example.com',
  buyerPhone: '',
  notes: '',
  quantity: 3,
  amount: 3000,
  sendEmail: false,
}

describe('orders and check-in (D1)', () => {
  it('creates one ticket per seat with unique codes', async () => {
    const orderId = await repo.createOrder(sale, 'USD')
    const tickets = await repo.getOrderTickets(orderId)
    expect(tickets.map((t) => t.seq)).toEqual([1, 2, 3])
    expect(tickets.every((t) => t.orderId === orderId)).toBe(true)
    expect(new Set(tickets.map((t) => t.code)).size).toBe(3)
    expect(await repo.getOrder(orderId)).toMatchObject({ buyerName: 'Jane Doe', quantity: 3, checkedIn: 0 })
  })

  it('keeps each order’s tickets on that order', async () => {
    const [a, b] = [await repo.createOrder(sale, 'USD'), await repo.createOrder({ ...sale, quantity: 2 }, 'USD')]
    expect((await repo.getOrderTickets(a)).length).toBe(3)
    expect((await repo.getOrderTickets(b)).length).toBe(2)
  })

  it('admits a ticket exactly once', async () => {
    const [ticket] = await repo.getOrderTickets(await repo.createOrder(sale, 'USD'))
    expect((await repo.checkInTicket(ticket.id, 'Door Volunteer')).status).toBe('checked_in')
    const second = await repo.checkInTicket(ticket.id, 'Door Volunteer')
    expect(second.status).toBe('already_checked_in')
    expect(second.status === 'already_checked_in' && second.ticket.checkedInBy).toBe('Door Volunteer')
    await repo.undoCheckIn(ticket.id)
    expect((await repo.checkInTicket(ticket.id, 'Door Volunteer')).status).toBe('checked_in')
  })

  it('admits each ticket once even when scanned concurrently', async () => {
    const [ticket] = await repo.getOrderTickets(await repo.createOrder(sale, 'USD'))
    const results = await Promise.all(Array.from({ length: 5 }, () => repo.checkInTicket(ticket.id, 'Door')))
    expect(results.filter((r) => r.status === 'checked_in')).toHaveLength(1)
  })

  it('rejects tickets from cancelled orders and unknown ids', async () => {
    const orderId = await repo.createOrder(sale, 'USD')
    const [ticket] = await repo.getOrderTickets(orderId)
    await repo.setOrderCancelled(orderId, true, 'refunded')
    expect((await repo.checkInTicket(ticket.id, 'Door')).status).toBe('cancelled')
    expect(await repo.checkInRemaining(orderId, 'Door')).toBe(0)
    expect((await repo.checkInTicket(randomTicketId(), 'Door')).status).toBe('invalid')
  })

  it('checks in the rest of a group at once', async () => {
    const orderId = await repo.createOrder(sale, 'USD')
    const [first] = await repo.getOrderTickets(orderId)
    await repo.checkInTicket(first.id, 'Door')
    expect(await repo.checkInRemaining(orderId, 'Door')).toBe(2)
    expect((await repo.getOrderTickets(orderId)).every((t) => t.checkedInAt)).toBe(true)
  })

  it('finds tickets by name, order number or code, with LIKE wildcards escaped', async () => {
    const orderId = await repo.createOrder({ ...sale, buyerName: 'Zoë 100% Real' }, 'USD')
    const [ticket] = await repo.getOrderTickets(orderId)
    expect((await repo.searchTickets('zoë', '')).some((t) => t.id === ticket.id)).toBe(true)
    expect((await repo.searchTickets('100%', '')).every((t) => t.buyerName.includes('100%'))).toBe(true)
    expect((await repo.searchTickets(`#${orderId}`, '')).map((t) => t.orderId)).toContain(orderId)
    expect((await repo.searchTickets('xx', ticket.code)).map((t) => t.id)).toContain(ticket.id)
  })

  it('reports totals for active orders only', async () => {
    const before = await repo.getStats()
    const orderId = await repo.createOrder({ ...sale, quantity: 2, amount: 2000 }, 'USD')
    expect(await repo.getStats()).toMatchObject({
      orders: before.orders + 1,
      ticketsSold: before.ticketsSold + 2,
      revenue: before.revenue + 2000,
    })
    await repo.setOrderCancelled(orderId, true)
    expect(await repo.getStats()).toMatchObject({ orders: before.orders, revenue: before.revenue })
  })

  it('exports orders with their ticket codes', async () => {
    const orderId = await repo.createOrder(sale, 'USD')
    const row = (await repo.exportOrders()).find((r) => r.id === orderId)
    expect(row?.ticketCodes).toHaveLength(3)
  })
})

// The auth module reads cookies and headers through TanStack Start's request
// context, which only exists inside the Start Vite plugin; stub it here.
vi.mock('@tanstack/react-start/server', () => ({ getRequestHeaders: () => new Headers() }))
vi.mock('better-auth/tanstack-start', () => ({ tanstackStartCookies: () => ({ id: 'tanstack-start-cookies' }) }))

describe('default admin', () => {
  it('creates the ADMIN_EMAIL organizer once', async () => {
    const { ensureDefaultAdmin } = await import('#/server/auth/auth.server')
    await ensureDefaultAdmin()
    await ensureDefaultAdmin()
    const { results } = await env.DB.prepare('SELECT email, role, email_verified FROM user').all()
    expect(results).toEqual([{ email: 'organizer@example.com', role: 'admin', email_verified: 1 }])
  })
})
