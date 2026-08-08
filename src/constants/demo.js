// Roles a visitor can assume in the public demo. Mirrors the User
// model's role enum. Used by the demo-login endpoint to validate the
// requested role.
export const DEMO_ROLES = [
  'operator',
  'manager',
  'maintenanceWorker',
  'safety',
  'admin',
];

// Read at call time (not module load) so it reflects the environment
// after dotenv/config has run, regardless of import order.
export const isDemoMode = () => process.env.DEMO_MODE === 'true';
