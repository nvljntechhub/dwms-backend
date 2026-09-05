enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  WAREHOUSE_MANAGER = 'WAREHOUSE_MANAGER',
  STAFF = 'STAFF',
  DRIVER = 'DRIVER',
}

/** Roles that can be assigned via POST/PATCH /users. SUPER_ADMIN is created only at dealer register. */
const ASSIGNABLE_USER_ROLES = [
  UserRole.ADMIN,
  UserRole.WAREHOUSE_MANAGER,
  UserRole.STAFF,
  UserRole.DRIVER,
] as const;

export { UserRole, ASSIGNABLE_USER_ROLES };
