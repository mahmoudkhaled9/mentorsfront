import { useEffect, useState } from 'react';
import { GenericCrudPage } from '@/components/admin/GenericCrudPage';
import { apiFetch } from '@/lib/api';
import type { Department, JobTitle } from '@/types';

export default function AdminJobTitles() {
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    const load = async () => {
      const response = await apiFetch('departments');
      if (!response.ok) return;
      setDepartments((await response.json()) as Department[]);
    };
    load().catch(() => undefined);
  }, []);

  return (
    <GenericCrudPage<JobTitle>
      title="Job Titles"
      description="Manage job titles and assign them to departments."
      endpoint="jobtitles"
      itemLabel="job title"
      createLabel="Add Job Title"
      emptyForm={{ name: '', departmentId: '' }}
      fields={[
        { name: 'name', label: 'Title Name', type: 'text', placeholder: 'Property Advisor' },
        {
          name: 'departmentId',
          label: 'Department',
          type: 'select',
          options: departments.map((department) => ({ label: department.name, value: department.id })),
        },
      ]}
      columns={[
        { header: 'Name', render: (item) => item.name },
        { header: 'Department', render: (item) => item.departmentName ?? 'Sales' },
      ]}
      mapItemToForm={(item) => ({
        name: item.name,
        departmentId: item.departmentId?.toString() ?? '',
      })}
    />
  );
}
