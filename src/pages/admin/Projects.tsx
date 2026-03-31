import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  FolderOpen,
  Edit,
  Trash2,
  Building2,
  MapPin,
  Banknote
} from 'lucide-react';
import { toast } from 'sonner';
import { jsonRequest } from '@/lib/mutations';

export default function AdminProjects() {
  const { projects, setProjects, developers } = useData();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<typeof projects[0] | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDeveloper, setNewProjectDeveloper] = useState('');
  const [newProjectLocation, setNewProjectLocation] = useState('');

  const handleAdd = async () => {
    if (!newProjectName.trim() || !newProjectDeveloper) {
      toast.error('Project name and developer are required');
      return;
    }
    const developer = developers.find(d => d.id.toString() === newProjectDeveloper);

    try {
      const created = await jsonRequest<{ ok: boolean; id?: number }>('projects', {
        method: 'POST',
        body: {
          name: newProjectName.trim(),
          developerId: Number(newProjectDeveloper),
        },
      });
      const nextId = created.id ?? (projects.length > 0 ? Math.max(...projects.map(p => p.id)) + 1 : 1);
      setProjects(prev => [
        ...prev,
        {
          id: nextId,
          name: newProjectName.trim(),
          developerId: Number(newProjectDeveloper),
          developerName: developer?.name,
          location: newProjectLocation.trim() || undefined,
        },
      ]);
      toast.success('Project added successfully!');
      setShowAddDialog(false);
      setNewProjectName('');
      setNewProjectDeveloper('');
      setNewProjectLocation('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleEdit = (project: typeof projects[0]) => {
    setEditingProject(project);
    setNewProjectName(project.name);
    setNewProjectDeveloper(project.developerId.toString());
    setNewProjectLocation(project.location || '');
  };

  const handleSaveEdit = async () => {
    if (!editingProject) return;
    const developer = developers.find(d => d.id.toString() === newProjectDeveloper);

    try {
      await jsonRequest(`projects/${editingProject.id}`, {
        method: 'PUT',
        body: {
          name: newProjectName.trim(),
          developerId: Number(newProjectDeveloper),
        },
      });
      setProjects(prev =>
        prev.map(project =>
          project.id === editingProject.id
            ? {
                ...project,
                name: newProjectName.trim(),
                developerId: Number(newProjectDeveloper),
                developerName: developer?.name,
                location: newProjectLocation.trim() || undefined,
              }
            : project
        )
      );
      toast.success('Project updated successfully!');
      setEditingProject(null);
      setNewProjectName('');
      setNewProjectDeveloper('');
      setNewProjectLocation('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async (projectId: number) => {
    try {
      await jsonRequest(`projects/${projectId}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(project => project.id !== projectId));
      toast.success('Project deleted successfully!');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const getDeveloperName = (developerId: number) => {
    const developer = developers.find(d => d.id === developerId);
    return developer?.name || 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Projects Management</h1>
          <span className="text-gray-500">({projects.length} projects)</span>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input 
                placeholder="Project Name" 
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
              <Select value={newProjectDeveloper} onValueChange={setNewProjectDeveloper}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Developer" />
                </SelectTrigger>
                <SelectContent>
                  {developers.map(dev => (
                    <SelectItem key={dev.id} value={dev.id.toString()}>
                      {dev.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input 
                placeholder="Location" 
                value={newProjectLocation}
                onChange={(e) => setNewProjectLocation(e.target.value)}
              />
              <Button onClick={handleAdd}>
                Add Project
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox />
                  </TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Developer</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Starting Price</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Checkbox />
                    </TableCell>
                    <TableCell className="font-medium">{project.id}</TableCell>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {project.developerName || getDeveloperName(project.developerId)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {project.location ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          {project.location}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {project.startingPrice ? (
                        <div className="flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-gray-400" />
                          {(project.startingPrice / 1000000).toFixed(0)}M EGP
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleEdit(project)}
                        >
                          <Edit className="w-4 h-4 text-green-500" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleDelete(project.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingProject} onOpenChange={() => setEditingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input 
              placeholder="Project Name" 
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <Select value={newProjectDeveloper} onValueChange={setNewProjectDeveloper}>
              <SelectTrigger>
                <SelectValue placeholder="Select Developer" />
              </SelectTrigger>
              <SelectContent>
                {developers.map(dev => (
                  <SelectItem key={dev.id} value={dev.id.toString()}>
                    {dev.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input 
              placeholder="Location" 
              value={newProjectLocation}
              onChange={(e) => setNewProjectLocation(e.target.value)}
            />
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Info Card */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg">
              <FolderOpen className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Projects Management</h3>
              <p className="text-sm text-gray-600 mt-1">
                Projects are linked to developers and can be assigned to leads. 
                This helps agents know which properties to offer to potential clients.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
