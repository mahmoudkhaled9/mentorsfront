import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft, 
  Phone, 
  MessageCircle, 
  Globe, 
  Mail, 
  Settings,
  Building2,
  User,
  MapPin
} from 'lucide-react';
import { jsonRequest } from '@/lib/mutations';

export default function DeveloperDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { developers, setDevelopers, projects } = useData();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLogo, setEditLogo] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWhatsApp, setEditWhatsApp] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  const developer = developers.find(d => d.id === Number(id));
  const developerProjects = projects.filter(p => p.developerId === Number(id));

  if (!developer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Developer not found</p>
        <Button onClick={() => navigate('/developers')} className="mt-4">
          Back to Developers
        </Button>
      </div>
    );
  }

  const openEditDialog = () => {
    setEditName(developer.name);
    setEditLogo(developer.logo);
    setEditPhone(developer.phone);
    setEditWhatsApp(developer.whatsapp);
    setEditEmail(developer.email);
    setEditWebsite(developer.website);
    setEditDescription(developer.description);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    try {
      await jsonRequest(`developers/${developer.id}`, {
        method: 'PUT',
        body: {
          name: editName.trim() || developer.name,
          logo: editLogo.trim() || developer.logo,
          phone: editPhone.trim() || developer.phone,
          whatsapp: editWhatsApp.trim() || developer.whatsapp,
          email: editEmail.trim() || developer.email,
          website: editWebsite.trim() || developer.website,
          description: editDescription.trim() || developer.description,
        },
      });
      setDevelopers(prev =>
        prev.map(dev =>
          dev.id === developer.id
            ? {
                ...dev,
                name: editName.trim() || dev.name,
                logo: editLogo.trim() || dev.logo,
                phone: editPhone.trim() || dev.phone,
                whatsapp: editWhatsApp.trim() || dev.whatsapp,
                email: editEmail.trim() || dev.email,
                website: editWebsite.trim() || dev.website,
                description: editDescription.trim() || dev.description,
                lastUpdated: new Date().toLocaleDateString(),
              }
            : dev
        )
      );
      setShowEditDialog(false);
    } catch (error) {
      // Keep the dialog open so the user can retry with corrected data.
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/developers')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        </div>
        <Button variant="outline" size="icon" onClick={openEditDialog}>
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* About Developer & Contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* About Developer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About Developer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              {developer.logo ? (
                <img
                  src={developer.logo}
                  alt={developer.name}
                  className="w-16 h-16 object-contain"
                />
              ) : (
                <Building2 className="w-16 h-16 text-gray-400" />
              )}
              <div>
                <h3 className="font-semibold text-lg">{developer.name}</h3>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {developer.foundedBy && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span>Founded by: <span className="font-medium">{developer.foundedBy}</span></span>
                  {developer.establishedYear && (
                    <span className="text-gray-500">({developer.establishedYear})</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button 
                variant="default" 
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => window.open(`tel:${developer.phone}`)}
              >
                <Phone className="w-4 h-4 mr-2" />
                {developer.phone}
              </Button>
              <Button 
                variant="default" 
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => window.open(`https://wa.me/${developer.whatsapp.replace(/\+/g, '')}`)}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                {developer.whatsapp}
              </Button>
            </div>
            <Button 
              variant="default" 
              className="w-full bg-gray-900 hover:bg-gray-800"
              onClick={() => window.open(developer.website, '_blank')}
            >
              <Globe className="w-4 h-4 mr-2" />
              {developer.website}
            </Button>
            <Button 
              variant="default" 
              className="w-full bg-cyan-500 hover:bg-cyan-600"
              onClick={() => window.open(`mailto:${developer.email}`)}
            >
              <Mail className="w-4 h-4 mr-2" />
              {developer.email}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* About Developer Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About Developer</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 leading-relaxed">{developer.description}</p>
          
          {developer.establishedYear && (
            <div className="mt-6">
              <h4 className="font-bold text-lg mb-2">{developer.name.toUpperCase()} Brief:</h4>
              <p className="text-gray-700">
                Established by {developer.foundedBy} ({developer.establishedYear})
              </p>
            </div>
          )}

          {developerProjects.length > 0 && (
            <div className="mt-6">
              <h4 className="font-bold text-lg mb-3">Projects:</h4>
              <div className="space-y-3">
                {developerProjects.map((project) => (
                  <div key={project.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">
                          {project.name} {project.description && `(${project.description})`}
                        </p>
                        {project.startingPrice && (
                          <p className="text-sm text-gray-600 mt-1">
                            Starting price: {(project.startingPrice / 1000000).toFixed(0)}M EGP
                          </p>
                        )}
                        {project.downPayment && (
                          <p className="text-sm text-gray-600">
                            {project.downPayment}
                          </p>
                        )}
                      </div>
                      {project.location && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {project.location}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Developer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Developer Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <Input placeholder="Logo URL" value={editLogo} onChange={(e) => setEditLogo(e.target.value)} />
            <Input placeholder="Phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            <Input placeholder="WhatsApp" value={editWhatsApp} onChange={(e) => setEditWhatsApp(e.target.value)} />
            <Input placeholder="Email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            <Input placeholder="Website" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} />
            <Input placeholder="Description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
