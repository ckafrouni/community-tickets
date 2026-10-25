import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eventIdSchema, eventSchema } from '#/lib/schemas'
import { getEventAccess, requireEventAccess } from '#/server/access.server'
import { getEmailFrom, sendTestEmail } from '#/server/email.server'
import { authMiddleware } from '#/server/middleware'
import { createEvent, listEventsForUser, updateEvent } from '#/server/repo.server'
import { getBaseUrl } from '#/server/request.server'

export const listEventsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => ({
    events: await listEventsForUser(context.user.id, context.user.isAdmin),
    today: new Date().toISOString().slice(0, 10),
  }))

export const createEventFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(eventSchema)
  .handler(async ({ data, context }) => ({ eventId: await createEvent(data, context.user.id) }))

export const getEventFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(eventIdSchema)
  .handler(({ data, context }) => getEventAccess(context.user, data.eventId))

export const updateEventFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(eventSchema.extend(eventIdSchema.shape))
  .handler(async ({ data: { eventId, ...input }, context }) => {
    await requireEventAccess(context.user, eventId, 'organizer')
    await updateEvent(eventId, input)
    return { ok: true }
  })

export const eventEmailInfoFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(eventIdSchema)
  .handler(async ({ data, context }) => {
    await requireEventAccess(context.user, data.eventId, 'organizer')
    return { emailFrom: getEmailFrom(), baseUrl: getBaseUrl() }
  })

export const sendTestEmailFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(eventIdSchema.extend({ to: z.email() }))
  .handler(async ({ data, context }) => {
    const { event } = await requireEventAccess(context.user, data.eventId, 'organizer')
    await sendTestEmail(event, data.to)
    return { ok: true }
  })
