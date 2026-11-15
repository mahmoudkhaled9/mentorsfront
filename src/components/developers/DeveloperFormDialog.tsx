import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, errorMessage } from '@/lib/api';
import { jsonRequest } from '@/lib/mutations';
import { savedItem } from '@/lib/saved';
import { checkPhone } from '@/lib/phone';
import type { Developer } from '@/types';
import { useData } from '@/contexts/DataContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = add a new developer. */
  developer: Developer | null;
  onSaved: (developer: Developer) => void;
}

const FIELDS = [
  ['name', 'Developer Name *', 'text', 'Ora Developers'],
  ['logo', 'Logo', 'text', '/developers/hyde-park.jpg or https://...'],
  ['phone', 'Phone', 'tel', '01012345678'],
  ['whatsapp', 'WhatsApp', 'tel', '01012345678'],
  ['email', 'Email', 'email', 'info@example.com'],
  ['website', 'Website', 'url', 'https://example.com'],
] as const;

type Form = Record<(typeof FIELDS)[number][0] | 'description', string>;
const toForm = (d: Developer | null): Form => ({
  name: d?.name ?? '', logo: d?.logo ?? '', phone: d?.phone ?? '', whatsapp: d?.whatsapp ?? '', email: d?.email ?? '', website: d?.website ?? '', description: d?.description ?? '',
});

/** Add / edit a developer. Empty optional fields are saved empty (never as "-" placeholders the server would reject). */
export function DeveloperFormDialog({ open, onOpenChange, developer, onSaved }: Props) {
  const { reload } = useData();
  const [form, setForm] = useState<Form>(toForm(developer));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toForm(developer));
      setErrors({});
    }
  }, [open, developer]);

  const save = async () => {
    const problems: Record<string, string> = {};
    if (!form.name.trim()) problems.name = 'Name is required';
    const logo = form.logo.trim();
    if (logo && !/^(https?:\/\/|\/)[^\s"'<>]+$/i.test(logo)) problems.logo = 'Use a site path like /developers/hyde-park.jpg or an http(s) link';
    const phone = checkPhone(form.phone, { required: false, keep: developer?.phone });
    if (!phone.ok) problems.phone = phone.message;
    const whatsapp = checkPhone(form.whatsapp, { required: false, keep: developer?.whatsapp });
    if (!whatsapp.ok) problems.whatsapp = whatsapp.message;
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) problems.email = 'Enter a valid email address';
    if (form.website.trim() && !/^https?:\/\/\S+$/i.test(form.website.trim())) problems.website = 'The website must start with http:// or https://';
    setErrors(problems);
    if (Object.keys(problems).length || !phone.ok || !whatsapp.ok) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(), logo, phone: phone.value, whatsapp: whatsapp.value,
        email: form.email.trim(), website: form.website.trim(), description: form.description.trim(),
      };
      const result = developer
        ? await jsonRequest<{ item: Developer }>(`developers/${developer.id}`, { method: 'PUT', body })
        : await jsonRequest<{ item: Developer }>('developers', { method: 'POST', body });
      const saved = savedItem<Developer>(result);
      if (saved) onSaved(saved);
      else await reload(['developers']);
      toast.success(developer ? 'Developer updated' : 'Developer added');
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors);
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{developer ? 'Edit Developer' : 'Add Developer'}</DialogTitle>
          <DialogDescription>Only the name is required.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {FIELDS.map(([key, label, type, placeholder]) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`dev-${key}`}>{label}</Label>
              <Input
                id={`dev-${key}`}
                type={type}
                dir={type === 'tel' || type === 'url' ? 'ltr' : undefined}
                placeholder={placeholder}
                value={form[key]}
                aria-invalid={Boolean(errors[key])}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              />
              {errors[key] && <p className="text-xs text-red-600" role="alert">{errors[key]}</p>}
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor="dev-description">Description</Label>
            <Textarea id="dev-description" rows={4} maxLength={5000} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : developer ? 'Save Changes' : 'Add Developer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
