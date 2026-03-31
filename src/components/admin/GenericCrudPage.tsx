import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select';

export interface CrudField {
  name: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
  options?: { label: string; value: string | number }[];
}

export interface CrudColumn<T> {
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
}

interface GenericCrudPageProps<T extends { id: number }> {
  title: string;
  description?: string;
  endpoint: string;
  fields: CrudField[];
  columns: CrudColumn<T>[];
  emptyForm: Record<string, any>;
  mapItemToForm: (item: T) => Record<string, any>;
  createLabel?: string;
  itemLabel?: string;
  canDelete?: boolean;
}

export function GenericCrudPage<T extends { id: number }>({
  title,
  description,
  endpoint,
  fields,
  columns,
  emptyForm,
  mapItemToForm,
  createLabel = 'Add Item',
  itemLabel = 'item',
  canDelete = true,
}: GenericCrudPageProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, any>>(emptyForm);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to load data');
      }
      const data = (await response.json()) as T[];
      setItems(data);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingItem(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const handleOpenEdit = (item: T) => {
    setEditingItem(item);
    setForm(mapItemToForm(item));
    setShowDialog(true);
  };

  const handleSave = async () => {
    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem ? `${endpoint}/${editingItem.id}` : endpoint;
    try {
      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Failed to save ${itemLabel}`);
      }
      toast.success(`${editingItem ? 'Updated' : 'Created'} ${itemLabel} successfully`);
      setShowDialog(false);
      resetForm();
      await fetchItems();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await apiFetch(`${endpoint}/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Failed to delete ${itemLabel}`);
      }
      toast.success(`${itemLabel} deleted successfully`);
      await fetchItems();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const formRows = useMemo(() => fields, [fields]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description ? <p className="text-sm text-gray-500 mt-1">{description}</p> : null}
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-2" />
              {createLabel}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? `Edit ${itemLabel}` : `Add ${itemLabel}`}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {formRows.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>{field.label}</Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      id={field.name}
                      value={String(form[field.name] ?? '')}
                      onChange={(event) => setForm(prev => ({ ...prev, [field.name]: event.target.value }))}
                      placeholder={field.placeholder}
                    />
                  ) : field.type === 'select' ? (
                    <Select
                      value={String(form[field.name] ?? '')}
                      onValueChange={(value) => setForm(prev => ({ ...prev, [field.name]: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={field.placeholder ?? `Select ${field.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((option) => (
                          <SelectItem key={String(option.value)} value={String(option.value)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={field.name}
                      type={field.type ?? 'text'}
                      value={String(form[field.name] ?? '')}
                      onChange={(event) => setForm(prev => ({ ...prev, [field.name]: event.target.value }))}
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}
              <Button onClick={handleSave}>
                {editingItem ? 'Save Changes' : `Create ${itemLabel}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">#</TableHead>
                  {columns.map((column) => (
                    <TableHead key={column.header} className={column.className}>
                      {column.header}
                    </TableHead>
                  ))}
                  <TableHead className="w-32">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} className="text-center py-8 text-gray-500">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} className="text-center py-8 text-gray-500">
                      No {itemLabel}s found
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      {columns.map((column) => (
                        <TableCell key={column.header} className={column.className}>
                          {column.render(item)}
                        </TableCell>
                      ))}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(item)}>
                            <Pencil className="w-4 h-4 text-green-600" />
                          </Button>
                          {canDelete ? (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
