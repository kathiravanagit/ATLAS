import { getUser } from './auth';

export type Role = 'inspector' | 'analyst' | 'bank_officer' | 'admin';

export type Capability =
  | 'case.acknowledge'
  | 'case.assign'
  | 'case.escalate'
  | 'case.resolve'
  | 'alert.create'
  | 'review.decide'
  | 'blockchain.operate'
  | 'pii.request'
  | 'users.manage';

/**
 * Frontend role matrix. Mirrors backend RBAC intent so the UI never offers
 * misleading actions. The backend remains the enforcement authority —
 * this only controls visibility.
 */
const MATRIX: Record<Capability, Role[]> = {
  'case.acknowledge': ['inspector', 'analyst', 'admin'],
  'case.assign': ['inspector', 'admin'],
  'case.escalate': ['inspector', 'admin'],
  'case.resolve': ['inspector', 'admin'],
  'alert.create': ['inspector', 'analyst', 'admin'],
  'review.decide': ['inspector', 'analyst', 'admin'],
  'blockchain.operate': ['inspector', 'admin'],
  'pii.request': ['inspector', 'admin'],
  'users.manage': ['admin'],
};

export function currentRole(): Role | null {
  const user = getUser() as { role?: string } | null;
  const role = user?.role;
  return role === 'inspector' || role === 'analyst' || role === 'bank_officer' || role === 'admin'
    ? role
    : null;
}

export function can(capability: Capability, role?: Role | null): boolean {
  const r = role ?? currentRole();
  if (!r) return false;
  return MATRIX[capability].includes(r);
}
