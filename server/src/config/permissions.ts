import { PERMISSIONS, ROLE_PERMISSIONS, ROLES, type Permission, type Role } from '../config/constants.js';

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsForRole(role: Role): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Human readable permission matrix used by the admin UI and the API docs. */
export function permissionMatrix(): Record<string, Record<string, boolean>> {
  const roles = Object.keys(ROLE_PERMISSIONS) as Role[];
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const permission of PERMISSIONS) {
    matrix[permission] = {};
    for (const role of roles) {
      matrix[permission][role] = hasPermission(role, permission);
    }
  }
  return matrix;
}

export { ROLE_PERMISSIONS };
