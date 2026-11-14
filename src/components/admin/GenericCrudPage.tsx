import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, ApiError, errorMessage, readApiError } from '@/lib/api';
import { jsonRequest } from '@/lib/mutations';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'switch' | 'color' | 'tel' | 'email';

export type CrudForm = Record<string, string | boolean>;

export interface CrudField {
  name: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
  required?: boolean;
  /** Short help text under the field. */
  hint?: string;
  options?: { label: string; value: string | number }[];
  /** Lets a select say "none" (sends ''). */
  allowEmpty?: boolean;
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
  emptyForm: CrudForm;
  mapItemToForm: (item: T) => CrudForm;
  /** Turns the form into the request body (convert numbers, drop UI-only fields). Default: the form as is. */
  toBody?: (form: CrudForm, editing: T | null) => Record<string, unknown>;
  /** Extra client-side checks; return field errors. Required fields are checked automatically. */
  validate?: (form: CrudForm, editing: T | null) => Record<string, string>;
  /** Called after every successful create / update / delete, e.g. to refresh shared data. */
  onChanged?: () => void;
  createLabel?: string;
  itemLabel?: string;
  canDelete?: boolean;
  /** Shown below the table. */
  footer?: ReactNode;
}

const COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Red', value: '#DC2626' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Purple', value: '#9333EA' },
  { name: 'Gray', value: '#6B7280' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Teal', value: '#14B8A6' },
];

const NONE = '__none__';

/**
 * List + create/edit/delete page for one admin-managed table. Everything goes to the real API; the list is reloaded
 * from the server after each change so what is shown is what is stored. Server validation errors are shown on the
 * matching fields, and deletes are confirmed (the server refuses to delete items that are still in use).
 */
export function GenericCrudPage<T extends { id: number }>({
  title,
  description,
  endpoint,
  fields,
  columns,
  emptyForm,
  mapItemToForm,
  toBody,
  validate,
  onChanged,
  createLabel = 'Add Item',
  itemLabel = 'item',
  canDelete = true,
  footer,
}: GenericCrudPageProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [form, setForm] = useState<CrudForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  /** Loads the list from the server. Returns true on success (Retry uses it to report a repeated failure). */
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch(endpoint);
      if (!response.ok) throw await readApiError(response);
      const data = (await response.json()) as unknown;
      if (!Array.isArray(data)) throw new Error('The server answered with something that is not a list');
      setItems(data as T[]);
      setLoadError('');
      return true;
    } catch (error) {
      setLoadError(errorMessage(error));
      return false;
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  const retry = async () => {
    const ok = await fetchItems();
    if (ok) toast.success(`${title} loaded`);
    else toast.error(`Still could not load ${itemLabel}s - see the message on the page`);
  };

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setErrors({});
    setShowDialog(true);
  };

  const openEdit = (item: T) => {
    setEditingItem(item);
    setForm(mapItemToForm(item));
    setErrors({});
    setShowDialog(true);
  };

  const setValue = (name: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const labelOf = (name: string) => fields.find((f) => f.name === name)?.label ?? name;

  const handleSave = async () => {
    if (saving) return;
    const problems: Record<string, string> = {};
    for (const field of fields) {
      if (field.required && typeof form[field.name] !== 'boolean' && !String(form[field.name] ?? '').trim()) {
        problems[field.name] = `${field.label} is required`;
      }
    }
    Object.assign(problems, validate?.(form, editingItem) ?? {});
    setErrors(problems);
    if (Object.keys(problems).length) return;

    setSaving(true);
    try {
      const body = toBody ? toBody(form, editingItem) : form;
      await jsonRequest(editingItem ? `${endpoint}/${editingItem.id}` : endpoint, { method: editingItem ? 'PUT' : 'POST', body });
      toast.success(`${editingItem ? 'Updated' : 'Created'} ${itemLabel}`);
      setShowDialog(false);
      await fetchItems();
      onChanged?.();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, `${labelOf(k)} ${v}`])));
      }
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await jsonRequest(`${endpoint}/${deleting.id}`, { method: 'DELETE' });
      toast.success(`Deleted ${itemLabel}`);
      setDeleting(null);
      await fetchItems();
      onChanged?.();
    } catch (error) {
      // e.g. 409 "This status is still used by 12 leads" - keep the dialog's message in the toast
      toast.error(errorMessage(error));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const nameOf = (item: T) => String((item as unknown as { name?: unknown }).name ?? `#${item.id}`);

  const renderField = (field: CrudField) => {
    const id = `crud-${field.name}`;
    const value = form[field.name];
    const invalid = Boolean(errors[field.name]);
    switch (field.type) {
      case 'textarea':
        return <Textarea id={id} value={String(value ?? '')} aria-invalid={invalid} placeholder={field.placeholder} onChange={(e) => setValue(field.name, e.target.value)} />;
      case 'select':
        return (
          <Select value={String(value ?? '') || (field.allowEmpty ? NONE : '')} onValueChange={(v) => setValue(field.name, v === NONE ? '' : v)}>
            <SelectTrigger id={id} aria-label={field.label} aria-invalid={invalid}>
              <SelectValue placeholder={field.placeholder ?? `Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.allowEmpty ? <SelectItem value={NONE}>None</SelectItem> : null}
              {field.options?.map((option) => (
                <SelectItem key={String(option.value)} value={String(option.value)}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'switch':
        return (
          <div className="flex items-center gap-3">
            <Switch id={id} checked={Boolean(value)} onCheckedChange={(checked) => setValue(field.name, checked)} />
            <span className="text-sm text-gray-600">{value ? 'Active' : 'Inactive'}</span>
          </div>
        );
      case 'color':
        return (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={field.label}>
            {COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                role="radio"
                aria-checked={String(value).toLowerCase() === color.value.toLowerCase()}
                aria-label={color.name}
                title={color.name}
                onClick={() => setValue(field.name, color.value)}
                className={cn(
                  'h-9 w-9 rounded-lg border-2 transition-all',
                  String(value).toLowerCase() === color.value.toLowerCase() ? 'scale-110 border-gray-900' : 'border-transparent'
                )}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
        );
      default:
        return (
          <Input
            id={id}
            type={field.type ?? 'text'}
            dir={field.type === 'tel' ? 'ltr' : undefined}
            inputMode={field.type === 'number' ? 'numeric' : undefined}
            value={String(value ?? '')}
            aria-invalid={invalid}
            placeholder={field.placeholder}
            onChange={(e) => setValue(field.name, e.target.value)}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {createLabel}
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => !saving && setShowDialog(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="capitalize">{editingItem ? `Edit ${itemLabel}` : `Add ${itemLabel}`}</DialogTitle>
            <DialogDescription>Fields marked * are required.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            {fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={`crud-${field.name}`}>{field.label}{field.required ? ' *' : ''}</Label>
                {renderField(field)}
                {errors[field.name] ? (
                  <p className="text-xs text-red-600" role="alert">{errors[field.name]}</p>
                ) : field.hint ? (
                  <p className="text-xs text-gray-500">{field.hint}</p>
                ) : null}
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editingItem ? 'Save Changes' : `Create ${itemLabel}`}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && !deleteBusy && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {itemLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleting ? nameOf(deleting) : ''}&quot; will be removed permanently. Items that are still in use cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteBusy}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleteBusy ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  {columns.map((column) => (
                    <TableHead key={column.header} className={column.className}>{column.header}</TableHead>
                  ))}
                  <TableHead className="w-28">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !items.length && !loadError ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} className="py-8 text-center text-gray-500">Loading...</TableCell>
                  </TableRow>
                ) : loadError ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} className="py-8 text-center">
                      <p className="text-red-600" role="alert">Could not load {itemLabel}s: {loadError}</p>
                      <Button variant="outline" size="sm" className="mt-3" disabled={loading} onClick={() => void retry()}>
                        <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} /> {loading ? 'Retrying...' : 'Retry'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} className="py-8 text-center text-gray-500">No {itemLabel}s yet</TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      {columns.map((column) => (
                        <TableCell key={column.header} className={column.className}>{column.render(item)}</TableCell>
                      ))}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${nameOf(item)}`} title="Edit" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4 text-green-600" />
                          </Button>
                          {canDelete ? (
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Delete ${nameOf(item)}`} title="Delete" onClick={() => setDeleting(item)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
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
      {footer}
    </div>
  );
}
