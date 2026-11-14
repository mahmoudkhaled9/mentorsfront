import { OptionListPage } from '@/components/admin/OptionListPage';

export default function AdminDestinations() {
  return (
    <OptionListPage
      title="Destinations"
      description="Areas clients can ask for (New Cairo, North Coast...). Inactive destinations stay on existing leads but cannot be picked for new ones."
      endpoint="destinations"
      itemLabel="destination"
      placeholder="New Cairo"
    />
  );
}
