import { GenericCrudPage } from '@/components/admin/GenericCrudPage';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Globe } from 'lucide-react';
import type { LeadSource } from '@/types';

export default function AdminSources() {
  const { reload } = useData();
  return (
    <GenericCrudPage<LeadSource>
      title="Lead Sources"
      description="Where leads come from (Facebook, referral, billboard...). A source that is still used cannot be deleted."
      endpoint="lead-sources"
      itemLabel="source"
      createLabel="Add Source"
      emptyForm={{ name: '', color: '#3B82F6' }}
      fields={[
        { name: 'name', label: 'Source Name', required: true, placeholder: 'Facebook' },
        { name: 'color', label: 'Color', type: 'color' },
      ]}
      columns={[
        { header: 'Name', render: (s) => <span className="font-medium">{s.name}</span> },
        { header: 'Color', render: (s) => <span className="block h-8 w-8 rounded-lg border border-gray-200" style={{ backgroundColor: s.color }} title={s.color} /> },
      ]}
      mapItemToForm={(s) => ({ name: s.name, color: s.color || '#3B82F6' })}
      toBody={(f) => ({ name: String(f.name).trim(), color: f.color })}
      onChanged={() => void reload(['leadSources', 'leads'])}
      footer={
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-start gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <Globe className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Lead Sources</h3>
              <p className="mt-1 text-sm text-gray-600">
                Lead sources show which marketing channels bring in your leads, so you can see which ones work best.
              </p>
            </div>
          </CardContent>
        </Card>
      }
    />
  );
}
