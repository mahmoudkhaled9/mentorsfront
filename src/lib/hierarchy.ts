import type { User } from '@/types';
import { isSuperRole } from '@/lib/roles';

/**
 * The people whose records a user's screens summarise: themselves + everyone directly or indirectly below them
 * (teamLeaderId is the reporting parent). Same rule as the server's scope, which is what actually protects the data;
 * this only decides what the dashboard / report pickers offer. Administrators and franchise owners: everybody.
 */
export const getVisibleUserIds = (currentUser: User | null, users: User[]): number[] => {
  if (!currentUser) return [];
  if (isSuperRole(currentUser.role)) return users.map((user) => user.id);

  const children = new Map<number, number[]>();
  for (const u of users) {
    if (u.teamLeaderId === undefined || u.teamLeaderId === null) continue;
    children.set(u.teamLeaderId, [...(children.get(u.teamLeaderId) ?? []), u.id]);
  }
  const result = new Set<number>([currentUser.id]);
  const queue = [currentUser.id];
  while (queue.length) {
    for (const child of children.get(queue.shift() as number) ?? []) {
      if (!result.has(child)) { result.add(child); queue.push(child); }
    }
  }
  return Array.from(result);
};
