import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, 
  Phone, 
  MessageCircle, 
  Globe, 
  Mail, 
  Settings,
  User,
  MapPin
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { DeveloperFormDialog } from '@/components/developers/DeveloperFormDialog';
import { DeveloperLogo } from '@/components/developers/DeveloperLogo';
import { telHref, whatsappHref } from '@/lib/phone';

export default function DeveloperDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { developers, setDevelopers, projects, isLoading } = useData();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { isAdmin } = useAuth();

  const developer = developers.find(d => d.id === Number(id));
  const developerProjects = projects.filter(p => p.developerId === Number(id));

  if (!developer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{isLoading ? 'Loading developer...' : 'Developer not found'}</p>
        <Button onClick={() => navigate('/developers')} className="mt-4">
          Back to Developers
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" aria-label="Back to developers" onClick={() => navigate('/developers')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={() => setShowEditDialog(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Edit Developer
          </Button>
        )}
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
              <DeveloperLogo src={developer.logo} name={developer.name} className="w-16 h-16 object-contain" />
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
              {developer.phone ? (
                <Button asChild variant="default" className="flex-1 bg-green-600 hover:bg-green-700">
                  <a href={telHref(developer.phone)}>
                    <Phone className="w-4 h-4 mr-2" />
                    {developer.phone}
                  </a>
                </Button>
              ) : null}
              {whatsappHref(developer.whatsapp) ? (
                <Button asChild variant="default" className="flex-1 bg-green-600 hover:bg-green-700">
                  <a href={whatsappHref(developer.whatsapp)} target="_blank" rel="noreferrer noopener">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    {developer.whatsapp}
                  </a>
                </Button>
              ) : null}
            </div>
            {/^https?:\/\//i.test(developer.website) ? (
              <Button asChild variant="default" className="w-full bg-gray-900 hover:bg-gray-800">
                <a href={developer.website} target="_blank" rel="noreferrer noopener">
                  <Globe className="w-4 h-4 mr-2" />
                  {developer.website}
                </a>
              </Button>
            ) : null}
            {developer.email ? (
              <Button asChild variant="default" className="w-full bg-cyan-500 hover:bg-cyan-600">
                <a href={`mailto:${developer.email}`}>
                  <Mail className="w-4 h-4 mr-2" />
                  {developer.email}
                </a>
              </Button>
            ) : null}
            {!developer.phone && !developer.whatsapp && !developer.website && !developer.email ? (
              <p className="text-sm text-gray-500">No contact details yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* About Developer Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About Developer</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 leading-relaxed">{developer.description || 'No description yet.'}</p>
          
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
                        {project.startingPrice ? (
                          <p className="text-sm text-gray-600 mt-1">
                            Starting price: {project.startingPrice.toLocaleString('en-US')} EGP
                          </p>
                        ) : null}
                        {project.downPayment && (
                          <p className="text-sm text-gray-600">
                            {project.downPayment}
                          </p>
                        )}
                      </div>
                      {(project.location || project.destinationName) && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {[project.destinationName, project.location].filter(Boolean).join(' - ')}
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

      <DeveloperFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        developer={developer}
        onSaved={(saved) => setDevelopers((prev) => prev.map((d) => (d.id === saved.id ? saved : d)))}
      />
    </div>
  );
}
