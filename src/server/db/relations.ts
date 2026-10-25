import { defineRelations } from 'drizzle-orm'
import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
  events: {
    members: r.many.eventMembers(),
    orders: r.many.orders(),
    ticketTypes: r.many.ticketTypes(),
  },
  ticketTypes: {
    event: r.one.events({ from: r.ticketTypes.eventId, to: r.events.id, optional: false }),
  },
  eventMembers: {
    event: r.one.events({ from: r.eventMembers.eventId, to: r.events.id, optional: false }),
    user: r.one.user({ from: r.eventMembers.userId, to: r.user.id, optional: false }),
  },
  orders: {
    event: r.one.events({ from: r.orders.eventId, to: r.events.id, optional: false }),
    tickets: r.many.tickets(),
    payments: r.many.payments(),
  },
  payments: {
    order: r.one.orders({ from: r.payments.orderId, to: r.orders.id, optional: false }),
  },
  tickets: {
    order: r.one.orders({ from: r.tickets.orderId, to: r.orders.id, optional: false }),
    ticketType: r.one.ticketTypes({ from: r.tickets.ticketTypeId, to: r.ticketTypes.id }),
  },
  user: {
    sessions: r.many.session(),
    accounts: r.many.account(),
    memberships: r.many.eventMembers(),
  },
  session: {
    user: r.one.user({ from: r.session.userId, to: r.user.id, optional: false }),
  },
  account: {
    user: r.one.user({ from: r.account.userId, to: r.user.id, optional: false }),
  },
}))
