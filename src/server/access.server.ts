import { setResponseStatus } from '@tanstack/react-start/server'
import type { EventDetails, EventRole } from '#/lib/types'
import type { SessionUser } from './auth/auth.server'
import { getEvent, getMemberRole } from './repo.server'

export type EventAccess = { event: EventDetails; role: EventRole }

export async function getEventAccess(user: SessionUser, eventId: string): Promise<EventAccess | null> {
  const [event, role] = await Promise.all([getEvent(eventId), getMemberRole(eventId, user.id)])
  if (!event) return null
  if (user.isAdmin) return { event, role: 'organizer' }
  return role ? { event, role } : null
}

export async function requireEventAccess(user: SessionUser, eventId: string, need: EventRole): Promise<EventAccess> {
  const access = await getEventAccess(user, eventId)
  if (!access) {
    setResponseStatus(404)
    throw new Error('Event not found.')
  }
  if (need === 'organizer' && access.role !== 'organizer') {
    setResponseStatus(403)
    throw new Error('Only organizers can do this.')
  }
  return access
}
