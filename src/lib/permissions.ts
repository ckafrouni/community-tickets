import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access'

export const ac = createAccessControl(defaultStatements)

export const roles = {
  admin: ac.newRole(adminAc.statements),
  user: ac.newRole({}),
}

export type Role = keyof typeof roles
