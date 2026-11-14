import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Status } from '@/types';

interface Props {
  statuses: Status[];
  selected: string;
  onSelect: (status: string) => void;
  count: (status: string) => number;
}

/** "All" + one button per status, with the number of matching records. */
export function StatusTabs({ statuses, selected, onSelect, count }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Filter by status">
      <Button role="tab" aria-selected={selected === 'All'} variant={selected === 'All' ? 'default' : 'outline'} onClick={() => onSelect('All')} className="whitespace-nowrap">
        All
        <Badge variant="secondary" className="ml-2">{count('All')}</Badge>
      </Button>
      {statuses.map((status) => (
        <Button
          key={status.id}
          role="tab"
          aria-selected={selected === status.name}
          variant={selected === status.name ? 'default' : 'outline'}
          onClick={() => onSelect(status.name)}
          className="whitespace-nowrap"
          style={selected === status.name ? {} : { borderColor: status.color }}
        >
          {status.name}
          <Badge variant="secondary" className="ml-2" style={{ backgroundColor: `${status.color}20`, color: status.color }}>
            {count(status.name)}
          </Badge>
        </Button>
      ))}
    </div>
  );
}
