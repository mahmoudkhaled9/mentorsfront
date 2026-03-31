import { useData } from '@/contexts/DataContext';
import { GenericCrudPage } from '@/components/admin/GenericCrudPage';
import type { Broker } from '@/types';

export default function AdminBrokers() {
  const { developers } = useData();

  return (
    <GenericCrudPage<Broker>
      title="Brokers"
      description="Manage brokerage partners and link them to developers."
      endpoint="brokers"
      itemLabel="broker"
      createLabel="Add Broker"
      emptyForm={{ name: '', phone: '', developerId: '' }}
      fields={[
        { name: 'name', label: 'Broker Name', type: 'text', placeholder: 'Broker name' },
        { name: 'phone', label: 'Phone', type: 'text', placeholder: '+20...' },
        {
          name: 'developerId',
          label: 'Developer',
          type: 'select',
          options: developers.map((developer) => ({ label: developer.name, value: developer.id })),
        },
      ]}
      columns={[
        { header: 'Name', render: (item) => item.name },
        { header: 'Phone', render: (item) => item.phone ?? '-' },
        { header: 'Developer', render: (item) => item.developerName ?? 'Unknown' },
      ]}
      mapItemToForm={(item) => ({
        name: item.name,
        phone: item.phone ?? '',
        developerId: item.developerId?.toString() ?? '',
      })}
    />
  );
}
