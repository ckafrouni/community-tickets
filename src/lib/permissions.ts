import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access'

export const ac = createAccessControl(defaultStatements)

export const roles = {
  admin: ac.newRole(adminAc.statements),
  door: ac.newRole({}),
}

export type Role = keyof typeof roles

export function parseRole(value: string | null | undefined): Role | null {
  return value === 'admin' || value === 'door' ? value : null
}
