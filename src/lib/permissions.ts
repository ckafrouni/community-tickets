import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access'

// Roles for Better Auth's admin plugin, shared by the server and the client.
//  - admin: the organizer. Sells tickets, sees buyers, manages staff accounts.
//  - door:  volunteers at the entrance. Can only scan and check in tickets
//           (enforced by the app's server-function middleware).
export const ac = createAccessControl(defaultStatements)

export const roles = {
  admin: ac.newRole(adminAc.statements),
  door: ac.newRole({}),
}

export type Role = keyof typeof roles

export function parseRole(value: string | null | undefined): Role | null {
  return value === 'admin' || value === 'door' ? value : null
}
