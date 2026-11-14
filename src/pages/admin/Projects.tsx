import { GenericCrudPage, type CrudForm } from '@/components/admin/GenericCrudPage';
import { useData } from '@/contexts/DataContext';
import { parseAmount, formatMoney } from '@/lib/requirements';
import { Building2, MapPin } from 'lucide-react';
import type { Project } from '@/types';

export default function AdminProjects() {
  const { developers, leadOptions, reload } = useData();
  const destinations = leadOptions.destinations;

  return (
    <GenericCrudPage<Project>
      title="Projects Management"
      description="Projects of each developer. The destination links a project to the destinations clients ask for."
      endpoint="projects"
      itemLabel="project"
      createLabel="Add Project"
      emptyForm={{ name: '', developerId: '', destinationId: '', location: '', startingPrice: '', downPayment: '', description: '' }}
      fields={[
        { name: 'name', label: 'Project Name', required: true, placeholder: 'Mountain View iCity' },
        { name: 'developerId', label: 'Developer', type: 'select', required: true, options: developers.map((d) => ({ label: d.name, value: d.id })) },
        {
          name: 'destinationId', label: 'Destination', type: 'select', allowEmpty: true,
          options: destinations.filter((d) => d.isActive).map((d) => ({ label: d.name, value: d.id })),
          hint: 'Destinations are managed on the Destinations page.',
        },
        { name: 'location', label: 'Location', placeholder: 'Fifth Settlement' },
        { name: 'startingPrice', label: 'Starting price (EGP)', placeholder: '4,500,000' },
        { name: 'downPayment', label: 'Down payment / payment plan', placeholder: '10% down, 8 years' },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      validate={(f: CrudForm): Record<string, string> => (parseAmount(String(f.startingPrice)) === 'invalid' ? { startingPrice: 'Starting price must be a positive number' } : {})}
      columns={[
        { header: 'Name', render: (p) => <span className="font-medium">{p.name}</span> },
        {
          header: 'Developer',
          render: (p) => (
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              {p.developerName ?? developers.find((d) => d.id === p.developerId)?.name ?? '-'}
            </span>
          ),
        },
        { header: 'Destination', render: (p) => p.destinationName ?? '-' },
        {
          header: 'Location',
          render: (p) => (p.location ? <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-400" />{p.location}</span> : '-'),
        },
        { header: 'Starting Price', render: (p) => (p.startingPrice ? formatMoney(p.startingPrice) : '-') },
      ]}
      mapItemToForm={(p) => ({
        name: p.name,
        developerId: p.developerId ? String(p.developerId) : '',
        destinationId: p.destinationId ? String(p.destinationId) : '',
        location: p.location ?? '',
        startingPrice: p.startingPrice ? String(p.startingPrice) : '',
        downPayment: p.downPayment ?? '',
        description: p.description ?? '',
      })}
      toBody={(f) => {
        const price = parseAmount(String(f.startingPrice));
        return {
          name: String(f.name).trim(),
          developerId: Number(f.developerId),
          destinationId: f.destinationId ? Number(f.destinationId) : null,
          location: String(f.location).trim(),
          startingPrice: typeof price === 'number' ? price : '',
          downPayment: String(f.downPayment).trim(),
          description: String(f.description).trim(),
        };
      }}
      onChanged={() => void reload(['projects', 'leads'])}
    />
  );
}
