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
  Globe,
  Edit,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { jsonRequest } from '@/lib/mutations';

export default function AdminSources() {
  const { leadSources, setLeadSources } = useData();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSource, setEditingSource] = useState<typeof leadSources[0] | null>(null);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceColor, setNewSourceColor] = useState('#3B82F6');

  const handleAdd = async () => {
    if (!newSourceName.trim()) {
      toast.error('Source name is required');
      return;
    }

    try {
      const created = await jsonRequest<{ ok: boolean; id?: number }>('lead-sources', {
        method: 'POST',
        body: {
          name: newSourceName.trim(),
          color: newSourceColor,
        },
      });
      const nextId = created.id ?? (leadSources.length > 0 ? Math.max(...leadSources.map(s => s.id)) + 1 : 1);
      setLeadSources(prev => [...prev, { id: nextId, name: newSourceName.trim(), color: newSourceColor }]);
      toast.success('Source added successfully!');
      setShowAddDialog(false);
      setNewSourceName('');
      setNewSourceColor('#3B82F6');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleEdit = (source: typeof leadSources[0]) => {
    setEditingSource(source);
    setNewSourceName(source.name);
    setNewSourceColor(source.color);
  };

  const handleSaveEdit = async () => {
    if (!editingSource) return;

    try {
      await jsonRequest(`lead-sources/${editingSource.id}`, {
        method: 'PUT',
        body: {
          name: newSourceName.trim(),
          color: newSourceColor,
        },
      });
      setLeadSources(prev =>
        prev.map(source =>
          source.id === editingSource.id
            ? { ...source, name: newSourceName.trim(), color: newSourceColor }
            : source
        )
      );
      toast.success('Source updated successfully!');
      setEditingSource(null);
      setNewSourceName('');
      setNewSourceColor('#3B82F6');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async (sourceId: number) => {
    try {
      await jsonRequest(`lead-sources/${sourceId}`, { method: 'DELETE' });
      setLeadSources(prev => prev.filter(source => source.id !== sourceId));
      toast.success('Source deleted successfully!');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const colorOptions = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#22C55E' },
    { name: 'Red', value: '#DC2626' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Purple', value: '#9333EA' },
    { name: 'Gray', value: '#6B7280' },
    { name: 'Cyan', value: '#06B6D4' },
    { name: 'Pink', value: '#EC4899' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Source List</h1>
          <span className="text-gray-500">({leadSources.length} sources)</span>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add New source
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Source</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input 
                placeholder="Source Name (e.g., Meta, Internal Database)" 
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
              />
              <div>
                <label className="text-sm font-medium mb-2 block">Select Color</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setNewSourceColor(color.value)}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        newSourceColor === color.value ? 'border-gray-900 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
              <Button onClick={handleAdd}>
                Add Source
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sources Table */}
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
                  <TableHead>Color</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadSources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <Checkbox />
                    </TableCell>
                    <TableCell className="font-medium">{source.id}</TableCell>
                    <TableCell className="font-medium">{source.name}</TableCell>
                    <TableCell>
                      <div 
                        className="w-8 h-8 rounded-lg border border-gray-200"
                        style={{ backgroundColor: source.color }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleEdit(source)}
                        >
                          <Edit className="w-4 h-4 text-green-500" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleDelete(source.id)}
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
      <Dialog open={!!editingSource} onOpenChange={() => setEditingSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Source</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input 
              placeholder="Source Name" 
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
            />
            <div>
              <label className="text-sm font-medium mb-2 block">Select Color</label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setNewSourceColor(color.value)}
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${
                      newSourceColor === color.value ? 'border-gray-900 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Info Card */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg">
              <Globe className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Lead Sources</h3>
              <p className="text-sm text-gray-600 mt-1">
                Lead sources help you track where your leads are coming from. 
                This information is valuable for understanding which marketing channels 
                are most effective for your business.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
