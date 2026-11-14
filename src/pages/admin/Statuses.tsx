import { GenericCrudPage } from '@/components/admin/GenericCrudPage';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Palette } from 'lucide-react';
import type { Status } from '@/types';

export default function AdminStatuses() {
  const { reload } = useData();
  return (
    <GenericCrudPage<Status>
      title="Status Management"
      description="Statuses used for leads and cold calls. A status that is still used cannot be deleted."
      endpoint="statuses"
      itemLabel="status"
      createLabel="Add Status"
      emptyForm={{ name: '', color: '#3B82F6' }}
      fields={[
        { name: 'name', label: 'Status Name', required: true, placeholder: 'Interested' },
        { name: 'color', label: 'Color', type: 'color' },
      ]}
      columns={[
        { header: 'Name', render: (s) => <span className="font-medium">{s.name}</span> },
        { header: 'Color', render: (s) => <span className="block h-8 w-8 rounded-lg border border-gray-200" style={{ backgroundColor: s.color }} title={s.color} /> },
      ]}
      mapItemToForm={(s) => ({ name: s.name, color: s.color || '#3B82F6' })}
      toBody={(f) => ({ name: String(f.name).trim(), color: f.color })}
      onChanged={() => void reload(['statuses', 'leads', 'coldCalls'])}
      footer={
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-start gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <Palette className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Status Colors</h3>
              <p className="mt-1 text-sm text-gray-600">
                Each status has a color that helps agents identify lead status quickly. Renaming a status updates every lead
                and report that uses it.
              </p>
            </div>
          </CardContent>
        </Card>
      }
    />
  );
}
