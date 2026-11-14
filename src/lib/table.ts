import type { Comment } from '@/types';

/** Number of pages (at least 1, so an empty table still shows "page 1 of 1"). */
export const pageCount = (total: number, pageSize: number) => Math.max(1, Math.ceil(total / pageSize));

/** Comments of one lead / cold call (older rows have only leadId). */
export const commentsFor = (comments: Comment[], entityType: 'lead' | 'cold_call', entityId: number | null) =>
  entityId === null
    ? []
    : comments.filter((c) => (c.entityType ? c.entityType === entityType && c.entityId === entityId : entityType === 'lead' && c.leadId === entityId));
