import { env } from 'cloudflare:workers'
import { describe, expect, it, vi } from 'vite-plus/test'
import { formatMoney, inputToMinor, normalizeCode, parseEventDate } from '#/lib/format'
import { NEW_EVENT, type SaleInput } from '#/lib/schemas'
import { extractToken } from '#/lib/token'
import { randomCode, randomTicketId, signTicket, verifyTicketToken } from '#/server/crypto.server'
import { db } from '#/server/db/client.server'
import { user } from '#/server/db/schema'
import { renderTicketEmail } from '#/server/email-template.server'
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

  it('reads event dates from the date-time picker', () => {
    expect(parseEventDate('2026-11-14T18:00')).toEqual({
      month: 'NOV',
      day: '14',
      date: 'Saturday, November 14',
      time: '6:00 PM',
    })
    expect(parseEventDate('2026-02-30T10:00')).toBeNull()
    expect(parseEventDate('next friday')).toBeNull()
  })
})

describe('QR PNG encoder', () => {
  it('produces a valid PNG', async () => {
    const png = await qrPng('https://tickets.example.org/t/abc', 4)
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const view = new DataView(png.buffer, png.byteOffset)
    expect(new TextDecoder().decode(png.subarray(12, 16))).toBe('IHDR')
    expect(view.getUint32(16)).toBe(view.getUint32(20))
  })
})

const sale: SaleInput = {
  buyerName: 'Jane Doe',
  buyerEmail: 'jane@example.com',
  buyerPhone: '',
  notes: '',
  quantity: 3,
  amount: 3000,
}

async function makeUser(name = 'Host') {
  const id = randomTicketId()
  await db.insert(user).values({ id, name, email: `${id.toLowerCase()}@example.com`, emailVerified: true })
  return id
}

async function makeEvent(name = 'Spring Fair') {
  const host = await makeUser()
  const eventId = await repo.createEvent({ ...NEW_EVENT, name, startsAt: '2026-11-14T18:00' }, host)
  return { eventId, host }
}

describe('events and teams (D1)', () => {
  it('makes the creator a host and lists the event for them only', async () => {
    const { eventId, host } = await makeEvent()
    const stranger = await makeUser('Stranger')
    expect(await repo.getMemberRole(eventId, host)).toBe('organizer')
    expect((await repo.listEventsForUser(host, false)).map((e) => e.id)).toContain(eventId)
    expect((await repo.listEventsForUser(stranger, false)).map((e) => e.id)).not.toContain(eventId)
    expect((await repo.listEventsForUser(stranger, true)).find((e) => e.id === eventId)?.role).toBe('organizer')
  })

  it('counts sales and arrivals per event', async () => {
    const { eventId, host } = await makeEvent()
    const orderId = await repo.createOrder(eventId, sale, 'USD')
    const [ticket] = await repo.getOrderTickets(orderId)
    await repo.checkInTicket(eventId, ticket.id, 'Door')
    expect((await repo.listEventsForUser(host, false)).find((e) => e.id === eventId)).toMatchObject({
      ticketsSold: 3,
      checkedIn: 1,
    })
  })

  it('adds, re-roles and removes team members', async () => {
    const { eventId } = await makeEvent()
    const volunteer = await makeUser('Volunteer')
    await repo.addMember(eventId, volunteer, 'volunteer')
    expect(await repo.getMemberRole(eventId, volunteer)).toBe('volunteer')
    expect(await repo.countOrganizers(eventId)).toBe(1)
    await repo.addMember(eventId, volunteer, 'organizer')
    expect(await repo.countOrganizers(eventId)).toBe(2)
    expect((await repo.listMembers(eventId)).map((m) => m.name)).toEqual(['Host', 'Volunteer'])
    await repo.removeMember(eventId, volunteer)
    expect(await repo.getMemberRole(eventId, volunteer)).toBeNull()
  })
})

describe('orders and check-in (D1)', () => {
  it('creates one ticket per seat with unique codes', async () => {
    const { eventId } = await makeEvent()
    const orderId = await repo.createOrder(eventId, sale, 'USD')
    const tickets = await repo.getOrderTickets(orderId)
    expect(tickets.map((t) => t.seq)).toEqual([1, 2, 3])
    expect(tickets.every((t) => t.orderId === orderId && t.eventId === eventId)).toBe(true)
    expect(new Set(tickets.map((t) => t.code)).size).toBe(3)
    expect(await repo.getOrder(eventId, orderId)).toMatchObject({ buyerName: 'Jane Doe', quantity: 3, checkedIn: 0 })
  })

  it('keeps orders inside their event', async () => {
    const a = await makeEvent('A')
    const b = await makeEvent('B')
    const orderId = await repo.createOrder(a.eventId, sale, 'USD')
    expect(await repo.getOrder(b.eventId, orderId)).toBeNull()
    expect((await repo.listOrders(b.eventId, '')).map((o) => o.id)).not.toContain(orderId)
    await repo.setOrderCancelled(b.eventId, orderId, true)
    expect((await repo.getOrder(a.eventId, orderId))?.cancelledAt).toBeNull()
  })

  it('keeps each order’s tickets on that order', async () => {
    const { eventId } = await makeEvent()
    const a = await repo.createOrder(eventId, sale, 'USD')
    const b = await repo.createOrder(eventId, { ...sale, quantity: 2 }, 'USD')
    expect((await repo.getOrderTickets(a)).length).toBe(3)
    expect((await repo.getOrderTickets(b)).length).toBe(2)
  })

  it('admits a ticket exactly once', async () => {
    const { eventId } = await makeEvent()
    const [ticket] = await repo.getOrderTickets(await repo.createOrder(eventId, sale, 'USD'))
    expect((await repo.checkInTicket(eventId, ticket.id, 'Door Volunteer')).status).toBe('checked_in')
    const second = await repo.checkInTicket(eventId, ticket.id, 'Door Volunteer')
    expect(second.status).toBe('already_checked_in')
    expect(second.status === 'already_checked_in' && second.ticket.checkedInBy).toBe('Door Volunteer')
    expect(await repo.undoCheckIn(eventId, ticket.id)).toBe(true)
    expect((await repo.checkInTicket(eventId, ticket.id, 'Door Volunteer')).status).toBe('checked_in')
  })

  it('refuses tickets from another event', async () => {
    const a = await makeEvent('A')
    const b = await makeEvent('B')
    const [ticket] = await repo.getOrderTickets(await repo.createOrder(a.eventId, sale, 'USD'))
    expect(await repo.checkInTicket(b.eventId, ticket.id, 'Door')).toEqual({
      status: 'invalid',
      reason: 'This ticket is for a different event.',
    })
    expect((await repo.getTicket(ticket.id))?.checkedInAt).toBeNull()
    await repo.checkInTicket(a.eventId, ticket.id, 'Door')
    expect(await repo.undoCheckIn(b.eventId, ticket.id)).toBe(false)
    expect(await repo.checkInRemaining(b.eventId, ticket.orderId, 'Door')).toBe(0)
    expect((await repo.searchTickets(b.eventId, 'Jane', '')).map((t) => t.id)).not.toContain(ticket.id)
  })

  it('admits each ticket once even when scanned concurrently', async () => {
    const { eventId } = await makeEvent()
    const [ticket] = await repo.getOrderTickets(await repo.createOrder(eventId, sale, 'USD'))
    const results = await Promise.all(Array.from({ length: 5 }, () => repo.checkInTicket(eventId, ticket.id, 'Door')))
    expect(results.filter((r) => r.status === 'checked_in')).toHaveLength(1)
  })

  it('rejects tickets from cancelled orders and unknown ids', async () => {
    const { eventId } = await makeEvent()
    const orderId = await repo.createOrder(eventId, sale, 'USD')
    const [ticket] = await repo.getOrderTickets(orderId)
    await repo.setOrderCancelled(eventId, orderId, true, 'refunded')
    expect((await repo.checkInTicket(eventId, ticket.id, 'Door')).status).toBe('cancelled')
    expect(await repo.checkInRemaining(eventId, orderId, 'Door')).toBe(0)
    expect((await repo.checkInTicket(eventId, randomTicketId(), 'Door')).status).toBe('invalid')
  })

  it('checks in the rest of a group at once', async () => {
    const { eventId } = await makeEvent()
    const orderId = await repo.createOrder(eventId, sale, 'USD')
    const [first] = await repo.getOrderTickets(orderId)
    await repo.checkInTicket(eventId, first.id, 'Door')
    expect(await repo.checkInRemaining(eventId, orderId, 'Door')).toBe(2)
    expect((await repo.getOrderTickets(orderId)).every((t) => t.checkedInAt)).toBe(true)
  })

  it('finds tickets by name, order number or code, with LIKE wildcards escaped', async () => {
    const { eventId } = await makeEvent()
    await repo.createOrder(eventId, sale, 'USD')
    const orderId = await repo.createOrder(eventId, { ...sale, buyerName: 'Zoë 100% Real' }, 'USD')
    const [ticket] = await repo.getOrderTickets(orderId)
    expect((await repo.searchTickets(eventId, 'zoë', '')).some((t) => t.id === ticket.id)).toBe(true)
    expect((await repo.searchTickets(eventId, '100%', '')).every((t) => t.buyerName.includes('100%'))).toBe(true)
    expect((await repo.searchTickets(eventId, `#${orderId}`, '')).map((t) => t.orderId)).toContain(orderId)
    expect((await repo.searchTickets(eventId, 'xx', ticket.code)).map((t) => t.id)).toContain(ticket.id)
  })

  it('reports totals for active orders only', async () => {
    const { eventId } = await makeEvent()
    expect(await repo.getStats(eventId)).toEqual({ orders: 0, ticketsSold: 0, revenue: 0, checkedIn: 0 })
    const orderId = await repo.createOrder(eventId, { ...sale, quantity: 2, amount: 2000 }, 'USD')
    expect(await repo.getStats(eventId)).toMatchObject({ orders: 1, ticketsSold: 2, revenue: 2000 })
    await repo.setOrderCancelled(eventId, orderId, true)
    expect(await repo.getStats(eventId)).toMatchObject({ orders: 0, revenue: 0 })
  })

  it('exports an event’s orders with their ticket codes', async () => {
    const { eventId } = await makeEvent()
    const other = await makeEvent('Other')
    const orderId = await repo.createOrder(eventId, sale, 'USD')
    await repo.createOrder(other.eventId, sale, 'USD')
    const rows = await repo.exportOrders(eventId)
    expect(rows.map((r) => r.id)).toEqual([orderId])
    expect(rows[0].ticketCodes).toHaveLength(3)
  })
})

describe('ticket email', () => {
  it('shows the event date, venue and each ticket', async () => {
    const { eventId } = await makeEvent('Harvest Supper')
    const orderId = await repo.createOrder(eventId, { ...sale, quantity: 2 }, 'USD')
    const event = (await repo.getEvent(eventId))!
    const order = (await repo.getOrder(eventId, orderId))!
    const tickets = (await repo.getOrderTickets(orderId)).map((t) => ({
      seq: t.seq,
      code: t.code,
      url: `https://tickets.example.org/t/${t.id}`,
      cid: `ticket-${t.code}`,
    }))
    const { html, text } = renderTicketEmail({ ...event, venue: 'Town <Hall>' }, order, tickets)
    expect(text).toContain('Saturday, November 14 · 6:00 PM')
    expect(html).toContain('Town &lt;Hall&gt;')
    expect(html.match(/cid:ticket-/g)).toHaveLength(2)
  })
})

vi.mock('@tanstack/react-start/server', () => ({ getRequestHeaders: () => new Headers() }))
vi.mock('better-auth/tanstack-start', () => ({ tanstackStartCookies: () => ({ id: 'tanstack-start-cookies' }) }))

describe('default admin', () => {
  it('creates the ADMIN_EMAIL platform admin once', async () => {
    const { ensureDefaultAdmin } = await import('#/server/auth/auth.server')
    await ensureDefaultAdmin()
    await ensureDefaultAdmin()
    const { results } = await env.DB.prepare('SELECT email, role, email_verified FROM user WHERE email = ?')
      .bind('organizer@example.com')
      .all()
    expect(results).toEqual([{ email: 'organizer@example.com', role: 'admin', email_verified: 1 }])
  })
})
