import type { User } from '@/types';

export const getVisibleUserIds = (currentUser: User | null, users: User[]): number[] => {
  if (!currentUser) return [];
  if (currentUser.role === 'admin' || currentUser.role === 'franchise_owner') {
    return users.map(user => user.id);
  }

  const directReports = (parentId: number) =>
    users.filter(user => user.teamLeaderId === parentId).map(user => user.id);

  const result = new Set<number>([currentUser.id]);

  if (currentUser.role === 'director') {
    const salesManagers = directReports(currentUser.id);
    salesManagers.forEach(id => result.add(id));
    const teamLeaders = salesManagers.flatMap(directReports);
    teamLeaders.forEach(id => result.add(id));
    const agents = teamLeaders.flatMap(directReports);
    agents.forEach(id => result.add(id));
  } else if (currentUser.role === 'sales_manager' || currentUser.role === 'sales_supervisor') {
    const teamLeaders = directReports(currentUser.id);
    teamLeaders.forEach(id => result.add(id));
    const agents = teamLeaders.flatMap(directReports);
    agents.forEach(id => result.add(id));
  } else if (currentUser.role === 'team_leader') {
    const agents = directReports(currentUser.id);
    agents.forEach(id => result.add(id));
  }

  return Array.from(result);
};
