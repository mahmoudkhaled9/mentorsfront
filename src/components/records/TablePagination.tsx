import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pageCount } from '@/lib/table';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** "Showing 11 to 20 of 57 entries" + Prev / Next. `page` is clamped by the caller with pageCount(). */
export function TablePagination({ page, pageSize, total, onPageChange }: Props) {
  const pages = pageCount(total, pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
      <p className="text-sm text-gray-500" data-testid="pagination-summary">
        Showing {from} to {to} of {total} entries
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Prev
        </Button>
        <span className="min-w-[72px] text-center text-sm font-medium" aria-live="polite">
          Page {page} of {pages}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(pages, page + 1))} disabled={page >= pages}>
          Next
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
