import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eventIdSchema, memberSchema } from '#/lib/schemas'
import { requireEventAccess } from '#/server/access.server'
import { auth, createUserWithoutPassword } from '#/server/auth/auth.server'
import { INVITE_PARAM, sendAddedToEventEmail } from '#/server/email.server'
import { authMiddleware } from '#/server/middleware'
import {
  addMember,
  countOrganizers,
  findUserByEmail,
  getMemberRole,
  listMembers,
  removeMember,
} from '#/server/repo.server'
import { getBaseUrl } from '#/server/request.server'

const memberRef = eventIdSchema.extend({ userId: z.string().min(1).max(64) })

function sendInvite(eventId: string, email: string) {
  return auth.api.requestPasswordReset({
    body: { email, redirectTo: `/reset-password?${INVITE_PARAM}=${encodeURIComponent(eventId)}` },
  })
}

export const listMembersFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(eventIdSchema)
  .handler(async ({ data, context }) => {
    await requireEventAccess(context.user, data.eventId, 'organizer')
    return { members: await listMembers(data.eventId), currentUserId: context.user.id }
  })

export const addMemberFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(memberSchema.extend(eventIdSchema.shape))
  .handler(async ({ data, context }) => {
    const { event } = await requireEventAccess(context.user, data.eventId, 'organizer')
    const existing = await findUserByEmail(data.email)
    if (existing) {
      if (await getMemberRole(event.id, existing.id)) throw new Error(`${existing.email} is already on the team.`)
      await addMember(event.id, existing.id, data.role)
      await sendAddedToEventEmail({ to: existing, event, role: data.role, url: `${getBaseUrl()}/events/${event.id}` })
      return { invited: false }
    }
    const created = await createUserWithoutPassword({ email: data.email, name: data.name })
    await addMember(event.id, created.id, data.role)
    await sendInvite(event.id, data.email)
    return { invited: true }
  })

export const resendInviteFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(memberRef)
  .handler(async ({ data, context }) => {
    await requireEventAccess(context.user, data.eventId, 'organizer')
    const member = (await listMembers(data.eventId)).find((m) => m.userId === data.userId)
    if (!member) throw new Error('Not on the team.')
    await sendInvite(data.eventId, member.email)
    return { ok: true }
  })

export const removeMemberFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(memberRef)
  .handler(async ({ data, context }) => {
    await requireEventAccess(context.user, data.eventId, 'organizer')
    const role = await getMemberRole(data.eventId, data.userId)
    if (!role) throw new Error('Not on the team.')
    if (role === 'organizer' && (await countOrganizers(data.eventId)) <= 1) {
      throw new Error('An event needs at least one organizer. Add another organizer first.')
    }
    await removeMember(data.eventId, data.userId)
    return { ok: true }
  })
