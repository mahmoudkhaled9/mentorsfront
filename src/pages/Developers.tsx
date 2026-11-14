import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { DeveloperFormDialog } from '@/components/developers/DeveloperFormDialog';
import { DeveloperLogo } from '@/components/developers/DeveloperLogo';

export default function Developers() {
  const { developers, setDevelopers, isLoading } = useData();
  const { isAdmin } = useAuth();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All developers</h1>
          <p className="mt-1 text-gray-500">{developers.length} developers</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Developer
          </Button>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Overview</h2>
        {!developers.length && <p className="text-gray-500">{isLoading ? 'Loading developers...' : 'No developers yet.'}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {developers.map((developer) => (
            <Link key={developer.id} to={`/developers/${developer.id}`} className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardContent className="p-0">
                  <div className="flex h-40 items-center justify-center bg-[#F5E6C8] p-8">
                    <DeveloperLogo src={developer.logo} name={developer.name} className="max-h-24 max-w-full object-contain" />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900">{developer.name}</h3>
                    <p className="mt-1 text-sm text-gray-500">Last updated: {developer.lastUpdated || '-'}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <DeveloperFormDialog open={showAdd} onOpenChange={setShowAdd} developer={null} onSaved={(d) => setDevelopers((prev) => [...prev, d])} />
    </div>
  );
}
