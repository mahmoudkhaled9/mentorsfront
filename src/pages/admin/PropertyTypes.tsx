import { OptionListPage } from '@/components/admin/OptionListPage';

export default function AdminPropertyTypes() {
  return (
    <OptionListPage
      title="Property Types"
      description="Unit types clients can ask for (Studio, Duplex, Twin House...). Inactive types stay on existing leads but cannot be picked for new ones."
      endpoint="property-types"
      itemLabel="property type"
      placeholder="Townhouse"
    />
  );
}
