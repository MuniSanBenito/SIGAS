type AccessUserArgs = {
  req: {
    user: unknown
  }
}

type AccessUserWithIdArgs = AccessUserArgs & {
  id?: string | number
}

export const roleValues = ['admin', 'stock', 'administracion'] as const

export type Role = (typeof roleValues)[number]
export type ModuleKey = 'groups' | 'inventory' | 'deliveries'
export type RoleAwareUser = {
  id?: string | number
  roles?: unknown
}

export const roleOptions: { label: string; value: Role }[] = [
  { label: 'Administrador', value: 'admin' },
  { label: 'Control de stock', value: 'stock' },
  { label: 'Administración', value: 'administracion' },
]

const moduleRoles: Record<ModuleKey, readonly Role[]> = {
  groups: ['admin', 'administracion'],
  inventory: ['admin', 'stock'],
  deliveries: ['admin', 'administracion'],
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && roleValues.includes(value as Role)
}

export function getRoles(user: unknown): Role[] {
  if (!user || typeof user !== 'object') return []

  const roles = (user as RoleAwareUser).roles
  if (!Array.isArray(roles)) return []

  return roles.filter(isRole)
}

export function hasRole(user: unknown, role: Role): boolean {
  return getRoles(user).includes(role)
}

export function hasAnyRole(user: unknown, roles: readonly Role[]): boolean {
  const userRoles = getRoles(user)
  return roles.some((role) => userRoles.includes(role))
}

export function canAccessModule(user: unknown, module: ModuleKey): boolean {
  return hasAnyRole(user, moduleRoles[module])
}

export const inventoryOperator = ({ req: { user } }: AccessUserArgs): boolean =>
  canAccessModule(user, 'inventory')

export const groupOperator = ({ req: { user } }: AccessUserArgs): boolean =>
  canAccessModule(user, 'groups')

export const deliveryOperator = ({ req: { user } }: AccessUserArgs): boolean =>
  canAccessModule(user, 'deliveries')

export const authenticated = ({ req: { user } }: AccessUserArgs): boolean => Boolean(user)

export const adminOnly = ({ req: { user } }: AccessUserArgs): boolean => hasRole(user, 'admin')

export const adminOrSelf = ({ id, req: { user } }: AccessUserWithIdArgs): boolean => {
  if (!user) return false
  const userId = (user as RoleAwareUser).id
  return hasRole(user, 'admin') || (id != null && userId != null && String(userId) === String(id))
}
