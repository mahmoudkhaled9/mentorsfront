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
  Plus, 
  Edit,
  Trash2,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { jsonRequest } from '@/lib/mutations';

export default function AdminTitles() {
  const { titles, setTitles } = useData();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTitle, setEditingTitle] = useState<typeof titles[0] | null>(null);
  const [newTitleName, setNewTitleName] = useState('');
  const [newTitleDepartment, setNewTitleDepartment] = useState('Sales');

  const handleAdd = async () => {
    if (!newTitleName.trim()) {
      toast.error('Title name is required');
      return;
    }

    try {
      const created = await jsonRequest<{ ok: boolean; id?: number }>('titles', {
        method: 'POST',
        body: {
          name: newTitleName.trim(),
          department: newTitleDepartment.trim() || 'Sales',
        },
      });
      const nextId = created.id ?? (titles.length > 0 ? Math.max(...titles.map(t => t.id)) + 1 : 1);
      setTitles(prev => [
        ...prev,
        { id: nextId, name: newTitleName.trim(), department: newTitleDepartment.trim() || 'Sales' },
      ]);
      toast.success('Title added successfully!');
      setShowAddDialog(false);
      setNewTitleName('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleEdit = (title: typeof titles[0]) => {
    setEditingTitle(title);
    setNewTitleName(title.name);
    setNewTitleDepartment(title.department);
  };

  const handleSaveEdit = async () => {
    if (!editingTitle) return;

    try {
      await jsonRequest(`titles/${editingTitle.id}`, {
        method: 'PUT',
        body: {
          name: newTitleName.trim(),
          department: newTitleDepartment.trim() || 'Sales',
        },
      });
      setTitles(prev =>
        prev.map(title =>
          title.id === editingTitle.id
            ? { ...title, name: newTitleName.trim(), department: newTitleDepartment.trim() || 'Sales' }
            : title
        )
      );
      toast.success('Title updated successfully!');
      setEditingTitle(null);
      setNewTitleName('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async (titleId: number) => {
    try {
      await jsonRequest(`titles/${titleId}`, { method: 'DELETE' });
      setTitles(prev => prev.filter(title => title.id !== titleId));
      toast.success('Title deleted successfully!');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Titles Management</h1>
          <span className="text-gray-500">({titles.length} titles)</span>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Title
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Title</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input 
                placeholder="Title Name" 
                value={newTitleName}
                onChange={(e) => setNewTitleName(e.target.value)}
              />
              <Input 
                placeholder="Department" 
                value={newTitleDepartment}
                onChange={(e) => setNewTitleDepartment(e.target.value)}
              />
              <Button onClick={handleAdd}>
                Add Title
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Titles Table */}
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
                  <TableHead>Department</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {titles.map((title) => (
                  <TableRow key={title.id}>
                    <TableCell>
                      <Checkbox />
                    </TableCell>
                    <TableCell className="font-medium">{title.id}</TableCell>
                    <TableCell className="font-medium">{title.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {title.department}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleEdit(title)}
                        >
                          <Edit className="w-4 h-4 text-green-500" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleDelete(title.id)}
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
      <Dialog open={!!editingTitle} onOpenChange={() => setEditingTitle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Title</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input 
              placeholder="Title Name" 
              value={newTitleName}
              onChange={(e) => setNewTitleName(e.target.value)}
            />
            <Input 
              placeholder="Department" 
              value={newTitleDepartment}
              onChange={(e) => setNewTitleDepartment(e.target.value)}
            />
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
