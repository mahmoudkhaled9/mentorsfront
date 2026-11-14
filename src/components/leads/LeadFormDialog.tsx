import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { ApiError, apiFetch, errorMessage, readApiError } from '@/lib/api';
import { jsonRequest } from '@/lib/mutations';
import { checkPhone, CLIENT_PHONE_HINT } from '@/lib/phone';
import { fromRequirementsForm, toRequirementsForm, type RequirementsForm } from '@/lib/requirements';
import { savedId, savedItem } from '@/lib/saved';
import type { Comment, Lead } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RequirementsFields } from './RequirementsFields';

const NONE = '__none__';

interface LeadForm {
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  statusId: string;
  sourceId: string;
  projectId: string;
  comment: string;
  requirements: RequirementsForm;
}

const emptyForm = (statusId = ''): LeadForm => ({
  name: '', phone: '', whatsapp: '', email: '', statusId, sourceId: '', projectId: '', comment: '', requirements: toRequirementsForm(null),
});

const formFromLead = (lead: Lead): LeadForm => ({
  name: lead.name,
  phone: lead.phone ?? '',
  whatsapp: lead.whatsapp ?? '',
  email: lead.email ?? '',
  statusId: lead.statusId ? String(lead.statusId) : '',
  sourceId: lead.sourceId ? String(lead.sourceId) : '',
  projectId: lead.projectId ? String(lead.projectId) : '',
  comment: '',
  requirements: toRequirementsForm(lead.requirements),
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = add a new lead; a number = edit that lead (loaded fresh from the server when the dialog opens). */
  leadId: number | null;
  /** Called with the lead as the server saved it. */
  onSaved?: (lead: Lead) => void;
  /** Optional: scroll to / focus the client requirements (used by the Call Action's "Edit requirements"). */
  focusRequirements?: boolean;
}

/**
 * Add / Edit Lead - THE place where a lead's data, including Delivery / Finishing / Purpose of purchase, is edited.
 * Used by the Leads page, the Lead Details page and the Call Action ("Edit lead requirements").
 */
export function LeadFormDialog({ open, onOpenChange, leadId, onSaved, focusRequirements = false }: Props) {
  const { statuses, leadSources, projects, setLeads, setComments, reload } = useData();
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // read the lead from the server every time the form opens, so it shows what is really stored
  const load = useCallback(async () => {
    if (leadId === null) return;
    setLoading(true);
    try {
      const response = await apiFetch(`leads/${leadId}`);
      if (!response.ok) throw await readApiError(response);
      const lead = (await response.json()) as Lead;
      setEditing(lead);
      setForm(formFromLead(lead));
      setFormErrors({});
      setLoadError('');
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  const [openedFor, setOpenedFor] = useState<string>('');
  const openKey = open ? `open:${leadId ?? 'new'}` : '';
  if (openedFor !== openKey) {
    setOpenedFor(openKey);
    if (open && leadId === null) {
      setEditing(null);
      setForm(emptyForm(statuses[0] ? String(statuses[0].id) : ''));
      setFormErrors({});
      setLoadError('');
    }
    if (open && leadId !== null) {
      setEditing(null);
      setLoadError('');
    }
  }
  useEffect(() => {
    if (open && leadId !== null) void load();
  }, [open, leadId, load]);

  const setField = <K extends keyof LeadForm>(key: K, value: LeadForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // an edited field is no longer "wrong" until the next save checks it again
    setFormErrors((prev) => {
      const stale = Object.keys(prev).filter((k) => (key === 'requirements' ? k.startsWith('requirements.') : k === key));
      if (!stale.length) return prev;
      const next = { ...prev };
      stale.forEach((k) => delete next[k]);
      return next;
    });
  };

  const statusOrProjectChanged = Boolean(editing) && (
    form.statusId !== (editing?.statusId ? String(editing.statusId) : '') || form.projectId !== (editing?.projectId ? String(editing.projectId) : '')
  );

  const saveLead = async () => {
    if (saving) return;
    const problems: Record<string, string> = {};
    if (!form.name.trim()) problems.name = 'Name is required';
    const phone = checkPhone(form.phone, { required: true, keep: editing?.phone });
    if (!phone.ok) problems.phone = phone.message;
    const whatsapp = checkPhone(form.whatsapp, { required: false, keep: editing?.whatsapp });
    if (!whatsapp.ok) problems.whatsapp = whatsapp.message;
    if (form.email.trim() && !EMAIL.test(form.email.trim())) problems.email = 'Enter a valid email address';
    if (!form.statusId) problems.statusId = 'Choose a status';
    if (statusOrProjectChanged && !form.comment.trim()) problems.comment = 'Add a comment explaining the status / project change';
    const req = fromRequirementsForm(form.requirements);
    Object.assign(problems, req.errors);
    setFormErrors(problems);
    if (Object.keys(problems).length || !phone.ok || !whatsapp.ok) {
      toast.error('Please fix the highlighted fields');
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        phone: phone.value,
        whatsapp: whatsapp.value,
        email: form.email.trim(),
        statusId: Number(form.statusId),
        sourceId: form.sourceId ? Number(form.sourceId) : 0,
        projectId: form.projectId ? Number(form.projectId) : null,
        requirements: req.value,
      };
      const result = editing
        ? await jsonRequest<{ item: Lead }>(`leads/${editing.id}`, { method: 'PUT', body })
        : await jsonRequest<{ item: Lead }>('leads', { method: 'POST', body });
      const saved = savedItem<Lead>(result);
      const savedRecordId = saved?.id ?? savedId(result) ?? editing?.id ?? null;
      if (saved) setLeads((prev) => (editing ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved]));
      else await reload(['leads']); // unexpected answer shape: show what the server has
      if (form.comment.trim() && savedRecordId) {
        try {
          const comment = await jsonRequest<{ item: Comment }>('comments', { method: 'POST', body: { entityType: 'lead', entityId: savedRecordId, content: form.comment.trim() } });
          const savedComment = savedItem<Comment>(comment);
          if (savedComment) setComments((prev) => [...prev, savedComment]);
          else void reload(['comments']);
        } catch (error) {
          toast.error(`The lead was saved, but the comment was not: ${errorMessage(error)}`);
        }
      }
      void reload(['reports']);
      toast.success(editing ? 'Lead updated' : 'Lead added');
      if (saved) onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setFormErrors((prev) => ({ ...prev, ...error.fieldErrors }));
      }
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const waiting = leadId !== null && !editing;

  return (
      <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Lead #${editing.id}` : 'Add New Lead'}</DialogTitle>
            <DialogDescription>Fields marked * are required. {CLIENT_PHONE_HINT}</DialogDescription>
          </DialogHeader>
          {waiting ? (
            loadError ? (
              <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p>Could not load this lead: {loadError}</p>
                <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Retry
                </Button>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-gray-500">Loading the lead...</p>
            )
          ) : (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void saveLead();
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField id="lead-name" label="Name *" value={form.name} error={formErrors.name} onChange={(v) => setField('name', v)} />
              <TextField id="lead-phone" label="Phone *" type="tel" value={form.phone} error={formErrors.phone} onChange={(v) => setField('phone', v)} placeholder="01012345678" />
              <TextField id="lead-whatsapp" label="WhatsApp" type="tel" value={form.whatsapp} error={formErrors.whatsapp} onChange={(v) => setField('whatsapp', v)} placeholder="Same as phone if empty" />
              <TextField id="lead-email" label="Email" type="email" value={form.email} error={formErrors.email} onChange={(v) => setField('email', v)} />
              <FormSelect id="lead-status" label="Status *" value={form.statusId} error={formErrors.statusId} onChange={(v) => setField('statusId', v)} options={statuses.map((s) => ({ value: String(s.id), label: s.name }))} />
              <FormSelect id="lead-source" label="Source" value={form.sourceId} allowEmpty onChange={(v) => setField('sourceId', v)} options={leadSources.map((s) => ({ value: String(s.id), label: s.name }))} />
              <FormSelect id="lead-project" label="Project" value={form.projectId} allowEmpty error={formErrors.projectId} onChange={(v) => setField('projectId', v)} options={projects.map((p) => ({ value: String(p.id), label: p.name }))} />
            </div>

            <div className="rounded-lg border border-gray-200 p-4" ref={(el) => { if (el && focusRequirements) el.scrollIntoView({ block: 'center' }); }}>
              <h3 className="mb-3 font-semibold text-gray-900">Client requirements</h3>
              <RequirementsFields value={form.requirements} onChange={(next) => setField('requirements', next)} errors={formErrors} idPrefix="lead-req" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="lead-comment">Comment{statusOrProjectChanged ? ' *' : ''}</Label>
              <Textarea
                id="lead-comment"
                rows={3}
                maxLength={5000}
                value={form.comment}
                aria-invalid={Boolean(formErrors.comment)}
                placeholder={statusOrProjectChanged ? 'Required: why did the status / project change?' : 'Optional - saved to the lead history and Reports'}
                onChange={(e) => setField('comment', e.target.value)}
              />
              {formErrors.comment && <p className="text-xs text-red-600" role="alert">{formErrors.comment}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Save Lead'}</Button>
            </DialogFooter>
          </form>
          )}
        </DialogContent>
      </Dialog>
  );
}

function TextField({ id, label, value, onChange, error, type = 'text', placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} dir={type === 'tel' ? 'ltr' : undefined} value={value} placeholder={placeholder} aria-invalid={Boolean(error)} onChange={(e) => onChange(e.target.value)} />
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

function FormSelect({ id, label, value, onChange, options, error, allowEmpty = false }: { id: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; error?: string; allowEmpty?: boolean }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || (allowEmpty ? NONE : '')} onValueChange={(v) => onChange(v === NONE ? '' : v)}>
        <SelectTrigger id={id} aria-label={label.replace(' *', '')} aria-invalid={Boolean(error)}>
          <SelectValue placeholder={`Select ${label.replace(' *', '').toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty && <SelectItem value={NONE}>None</SelectItem>}
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}
