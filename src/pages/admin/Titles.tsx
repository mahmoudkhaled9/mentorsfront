import { GenericCrudPage } from '@/components/admin/GenericCrudPage';
import { useData } from '@/contexts/DataContext';
import type { Title } from '@/types';

export default function AdminTitles() {
  const { reload } = useData();
  return (
    <GenericCrudPage<Title>
      title="Titles Management"
      description="Job titles shown on employee profiles. A department is created automatically if it does not exist yet."
      endpoint="titles"
      itemLabel="title"
      createLabel="Add Title"
      emptyForm={{ name: '', department: 'Sales' }}
      fields={[
        { name: 'name', label: 'Title Name', required: true, placeholder: 'Property Advisor' },
        { name: 'department', label: 'Department', required: true, placeholder: 'Sales' },
      ]}
      columns={[
        { header: 'Name', render: (t) => <span className="font-medium">{t.name}</span> },
        { header: 'Department', render: (t) => t.department },
      ]}
      mapItemToForm={(t) => ({ name: t.name, department: t.department || 'Sales' })}
      toBody={(f) => ({ name: String(f.name).trim(), department: String(f.department).trim() })}
      onChanged={() => void reload(['titles'])}
    />
  );
}
