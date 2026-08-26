// Canonical user roles. Single source shared by the User model enum and
// any validation that needs to constrain a value to a real role (e.g.
// warehouse role-grants in SystemSettings).
export const USER_ROLES = [
  'operator',
  'admin',
  'manager',
  'maintenanceWorker',
  'safety',
];
