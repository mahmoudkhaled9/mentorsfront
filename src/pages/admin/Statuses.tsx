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
  Palette
} from 'lucide-react';
import { toast } from 'sonner';
import { jsonRequest } from '@/lib/mutations';

export default function AdminStatuses() {
  const { statuses, setStatuses } = useData();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingStatus, setEditingStatus] = useState<typeof statuses[0] | null>(null);
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#3B82F6');

  const handleAdd = async () => {
    if (!newStatusName.trim()) {
      toast.error('Status name is required');
      return;
    }

    try {
      const created = await jsonRequest<{ ok: boolean; id?: number }>('statuses', {
        method: 'POST',
        body: {
          name: newStatusName.trim(),
          color: newStatusColor,
        },
      });
      const nextId = created.id ?? (statuses.length > 0 ? Math.max(...statuses.map(s => s.id)) + 1 : 1);
      setStatuses(prev => [...prev, { id: nextId, name: newStatusName.trim(), color: newStatusColor }]);
      toast.success('Status added successfully!');
      setShowAddDialog(false);
      setNewStatusName('');
      setNewStatusColor('#3B82F6');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleEdit = (status: typeof statuses[0]) => {
    setEditingStatus(status);
    setNewStatusName(status.name);
    setNewStatusColor(status.color);
  };

  const handleSaveEdit = async () => {
    if (!editingStatus) return;

    try {
      await jsonRequest(`statuses/${editingStatus.id}`, {
        method: 'PUT',
        body: {
          name: newStatusName.trim(),
          color: newStatusColor,
        },
      });
      setStatuses(prev =>
        prev.map(status =>
          status.id === editingStatus.id
            ? { ...status, name: newStatusName.trim(), color: newStatusColor }
            : status
        )
      );
      toast.success('Status updated successfully!');
      setEditingStatus(null);
      setNewStatusName('');
      setNewStatusColor('#3B82F6');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async (statusId: number) => {
    try {
      await jsonRequest(`statuses/${statusId}`, { method: 'DELETE' });
      setStatuses(prev => prev.filter(status => status.id !== statusId));
      toast.success('Status deleted successfully!');
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
          <h1 className="text-2xl font-bold text-gray-900">Status Management</h1>
          <span className="text-gray-500">({statuses.length} statuses)</span>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Status
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Status</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input 
                placeholder="Status Name" 
                value={newStatusName}
                onChange={(e) => setNewStatusName(e.target.value)}
              />
              <div>
                <label className="text-sm font-medium mb-2 block">Select Color</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setNewStatusColor(color.value)}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        newStatusColor === color.value ? 'border-gray-900 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
              <Button onClick={handleAdd}>
                Add Status
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statuses Table */}
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
                {statuses.map((status) => (
                  <TableRow key={status.id}>
                    <TableCell>
                      <Checkbox />
                    </TableCell>
                    <TableCell className="font-medium">{status.id}</TableCell>
                    <TableCell className="font-medium">{status.name}</TableCell>
                    <TableCell>
                      <div 
                        className="w-8 h-8 rounded-lg border border-gray-200"
                        style={{ backgroundColor: status.color }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleEdit(status)}
                        >
                          <Edit className="w-4 h-4 text-green-500" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleDelete(status.id)}
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
      <Dialog open={!!editingStatus} onOpenChange={() => setEditingStatus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input 
              placeholder="Status Name" 
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
            />
            <div>
              <label className="text-sm font-medium mb-2 block">Select Color</label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setNewStatusColor(color.value)}
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${
                      newStatusColor === color.value ? 'border-gray-900 scale-110' : 'border-transparent'
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
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
              <Palette className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Status Colors</h3>
              <p className="text-sm text-gray-600 mt-1">
                Each status has a unique color that helps agents quickly identify lead status. 
                These colors are used throughout the CRM in tables, filters, and dashboards.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
