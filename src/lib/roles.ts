import type { UserRole } from '@/types';

/** Same role sets as the backend (src/auth/policy.js). The server enforces them; the UI only hides what would be refused. */
export const SUPER_ROLES: UserRole[] = ['admin', 'franchise_owner'];
export const ASSIGNER_ROLES: UserRole[] = [...SUPER_ROLES, 'director', 'sales_manager', 'sales_supervisor', 'team_leader'];

export const isSuperRole = (role?: string | null) => SUPER_ROLES.includes(role as UserRole);
export const isAssignerRole = (role?: string | null) => ASSIGNER_ROLES.includes(role as UserRole);

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  franchise_owner: 'Franchise Owner',
  director: 'Director',
  sales_manager: 'Sales Manager',
  sales_supervisor: 'Sales Supervisor',
  team_leader: 'Team Leader',
  agent: 'Agent',
};

export const roleLabel = (role?: string | null) => (role ? ROLE_LABELS[role] ?? role.replace(/_/g, ' ') : '');
export const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value: value as UserRole, label }));
