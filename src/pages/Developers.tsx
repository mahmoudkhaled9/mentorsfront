import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Settings, Building2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { jsonRequest } from '@/lib/mutations';

export default function Developers() {
  const navigate = useNavigate();
  const { developers, setDevelopers } = useData();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLogo, setNewLogo] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newWhatsApp, setNewWhatsApp] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const handleAddDeveloper = async () => {
    if (!newName.trim()) {
      toast.error('Developer name is required');
      return;
    }

    try {
      const created = await jsonRequest<{ ok: boolean; id?: number }>('developers', {
        method: 'POST',
        body: {
          name: newName.trim(),
          logo: newLogo.trim() || 'https://via.placeholder.com/150/4A5568/FFFFFF?text=DEV',
          description: newDescription.trim() || 'No description provided.',
          phone: newPhone.trim() || '-',
          whatsapp: newWhatsApp.trim() || newPhone.trim() || '-',
          email: newEmail.trim() || '-',
          website: newWebsite.trim() || '-',
        },
      });
      const nextId = created.id ?? (developers.length > 0 ? Math.max(...developers.map(d => d.id)) + 1 : 1);
      setDevelopers(prev => [
        ...prev,
        {
          id: nextId,
          name: newName.trim(),
          logo: newLogo.trim() || 'https://via.placeholder.com/150/4A5568/FFFFFF?text=DEV',
          description: newDescription.trim() || 'No description provided.',
          phone: newPhone.trim() || '-',
          whatsapp: newWhatsApp.trim() || newPhone.trim() || '-',
          email: newEmail.trim() || '-',
          website: newWebsite.trim() || '-',
          lastUpdated: new Date().toLocaleDateString(),
        },
      ]);

      toast.success('Developer added successfully!');
      setShowAddDialog(false);
      setNewName('');
      setNewLogo('');
      setNewPhone('');
      setNewWhatsApp('');
      setNewEmail('');
      setNewWebsite('');
      setNewDescription('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All developers</h1>
          <p className="text-gray-500 mt-1">{developers.length} developers</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Settings className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Developer</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Input placeholder="Developer Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input placeholder="Logo URL (optional)" value={newLogo} onChange={(e) => setNewLogo(e.target.value)} />
              <Input placeholder="Phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              <Input placeholder="WhatsApp" value={newWhatsApp} onChange={(e) => setNewWhatsApp(e.target.value)} />
              <Input placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <Input placeholder="Website" value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} />
              <Input placeholder="Description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
              <Button onClick={handleAddDeveloper}>
                <Plus className="w-4 h-4 mr-2" />
                Add Developer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overview Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {developers.map((developer) => (
            <Card
              key={developer.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/developers/${developer.id}`)}
            >
              <CardContent className="p-0">
                {/* Logo Container */}
                <div className="bg-[#F5E6C8] p-8 flex items-center justify-center h-40">
                  {developer.logo ? (
                    <img
                      src={developer.logo}
                      alt={developer.name}
                      className="max-h-24 max-w-full object-contain"
                    />
                  ) : (
                    <Building2 className="w-16 h-16 text-gray-400" />
                  )}
                </div>
                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900">{developer.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Last updated: {developer.lastUpdated}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
