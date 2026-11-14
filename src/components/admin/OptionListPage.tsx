import { GenericCrudPage } from './GenericCrudPage';
import { useData } from '@/contexts/DataContext';
import { Badge } from '@/components/ui/badge';
import type { CrmOption } from '@/types';

interface Props {
  title: string;
  description: string;
  endpoint: 'destinations' | 'property-types';
  itemLabel: string;
  placeholder: string;
}

/** Admin page for an option list used by lead requirements (name, active flag, display order). */
export function OptionListPage({ title, description, endpoint, itemLabel, placeholder }: Props) {
  const { reload } = useData();
  return (
    <GenericCrudPage<CrmOption>
      title={title}
      description={description}
      endpoint={endpoint}
      itemLabel={itemLabel}
      createLabel={`Add ${itemLabel.replace(/^\w/, (c) => c.toUpperCase())}`}
      emptyForm={{ name: '', isActive: true, sortOrder: '' }}
      fields={[
        { name: 'name', label: 'Name', required: true, placeholder },
        { name: 'isActive', label: 'Status', type: 'switch' },
        { name: 'sortOrder', label: 'Display order', type: 'number', placeholder: '10', hint: 'Lower numbers are listed first.' },
      ]}
      validate={(f): Record<string, string> => (String(f.sortOrder).trim() && !/^\d{1,6}$/.test(String(f.sortOrder).trim()) ? { sortOrder: 'Display order must be a whole number' } : {})}
      columns={[
        { header: 'Name', render: (o) => <span className="font-medium">{o.name}</span> },
        { header: 'Status', render: (o) => (o.isActive ? <Badge className="bg-green-600">Active</Badge> : <Badge variant="secondary">Inactive</Badge>) },
        { header: 'Order', render: (o) => o.sortOrder },
      ]}
      mapItemToForm={(o) => ({ name: o.name, isActive: o.isActive, sortOrder: String(o.sortOrder ?? '') })}
      toBody={(f) => ({
        name: String(f.name).trim(),
        isActive: Boolean(f.isActive),
        ...(String(f.sortOrder).trim() ? { sortOrder: Number(f.sortOrder) } : {}),
      })}
      onChanged={() => void reload(['leadOptions', 'projects'])}
    />
  );
}
