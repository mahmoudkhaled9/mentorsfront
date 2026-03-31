import { GenericCrudPage } from '@/components/admin/GenericCrudPage';
import type { Department } from '@/types';

export default function AdminDepartments() {
  return (
    <GenericCrudPage<Department>
      title="Departments"
      description="Manage company departments."
      endpoint="departments"
      itemLabel="department"
      createLabel="Add Department"
      emptyForm={{ name: '' }}
      fields={[
        { name: 'name', label: 'Department Name', type: 'text', placeholder: 'Sales' },
      ]}
      columns={[
        { header: 'Name', render: (item) => item.name },
      ]}
      mapItemToForm={(item) => ({ name: item.name })}
    />
  );
}
