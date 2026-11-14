import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink, MessageCircle, Pencil, Phone, PhoneCall, RefreshCw } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { ApiError, apiFetch, errorMessage, readApiError } from '@/lib/api';
import { jsonRequest } from '@/lib/mutations';
import { telHref, whatsappHref } from '@/lib/phone';
import { savedItem } from '@/lib/saved';
import { choiceLabel } from '@/lib/requirements';
import type { CallRecord, Lead } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CallDetails } from './CallDetails';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';

export interface CallTarget {
  type: 'lead' | 'cold_call';
  id: number;
  name: string;
  phone: string;
  whatsapp?: string;
  statusId?: number;
}

interface Props {
  target: CallTarget | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (call: CallRecord) => void;
}

interface Form {
  /** the outcome = the record's new status (the CRM's admin-managed statuses) */
  statusId: string;
  notes: string;
  followUpAt: string;
}

const EMPTY_FORM: Form = { statusId: '', notes: '', followUpAt: '' };
const newRequestId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

/**
 * THE Call Action: the one form used everywhere a call is made or logged (leads table, lead details, cold calls).
 * Its own fields: Call outcome (required), notes, follow-up. Saves through POST /api/{leads|cold-calls}/:id/call-actions
 * and then shows exactly what was stored. A Save sent twice (double click, retry after an error) is stored once.
 *
 * Delivery / Finishing / Purpose of purchase are NOT edited here: they belong to the lead (one source of truth). The
 * form shows the values currently saved on the lead (read fresh from the server) and offers "Edit lead requirements",
 * which opens the same Edit Lead form used everywhere else.
 */
export function CallActionDialog({ target, onOpenChange, onSaved }: Props) {
  const { leadOptions, statuses, reload } = useData();
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [lead, setLead] = useState<Lead | null>(null);
  const [leadError, setLeadError] = useState('');
  const [leadLoading, setLeadLoading] = useState(false);
  const [editingLead, setEditingLead] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<CallRecord | null>(null);
  /** One id per attempt to log a call on one record; reused when Save is retried, renewed after success. */
  const requestId = useRef({ key: '', id: newRequestId() });

  /** "Log another call" on the same record. */
  const reset = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setSaved(null);
    requestId.current = { key: targetKey, id: newRequestId() };
  };

  // a new target = a new, empty call (reset during render, React's pattern for state derived from props)
  const targetKey = target ? `${target.type}:${target.id}` : '';
  const [formFor, setFormFor] = useState(targetKey);
  if (formFor !== targetKey) {
    setFormFor(targetKey);
    setForm(EMPTY_FORM);
    setErrors({});
    setSaved(null);
    setLead(null);
    setLeadError('');
  }

  // the lead's requirements as stored in the database (read-only here)
  const leadId = target?.type === 'lead' ? target.id : null;
  const loadLead = useCallback(async () => {
    if (leadId === null) return;
    setLeadLoading(true);
    try {
      const response = await apiFetch(`leads/${leadId}`);
      if (!response.ok) throw await readApiError(response);
      setLead((await response.json()) as Lead);
      setLeadError('');
    } catch (error) {
      setLeadError(errorMessage(error));
    } finally {
      setLeadLoading(false);
    }
  }, [leadId]);
  useEffect(() => {
    if (leadId !== null) void loadLead();
  }, [leadId, loadLead]);

  if (!target) return null;
  const set = (key: keyof Form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const save = async () => {
    if (saving) return;
    const problems: Record<string, string> = {};
    if (!form.statusId) problems.statusId = 'Choose the call outcome';
    let followUpIso: string | undefined;
    if (form.followUpAt) {
      const when = new Date(form.followUpAt);
      if (Number.isNaN(when.getTime())) problems.followUpAt = 'Enter a valid date and time';
      else if (when.getTime() < Date.now() - 60000) problems.followUpAt = 'The follow-up must be in the future';
      else followUpIso = when.toISOString();
    }
    setErrors(problems);
    if (Object.keys(problems).length) {
      toast.error('Please complete the required fields');
      return;
    }
    if (requestId.current.key !== targetKey) requestId.current = { key: targetKey, id: newRequestId() };
    setSaving(true);
    try {
      const result = await jsonRequest<{ item: CallRecord }>(`${target.type === 'lead' ? 'leads' : 'cold-calls'}/${target.id}/call-actions`, {
        method: 'POST',
        body: {
          statusId: Number(form.statusId),
          notes: form.notes.trim() || undefined,
          followUpAt: followUpIso,
          requestId: requestId.current.id,
        },
      });
      const call = savedItem<CallRecord>(result);
      if (!call) throw new Error('The server did not confirm the saved call. Open the call history to check before saving again.');
      setSaved(call);
      requestId.current = { key: targetKey, id: newRequestId() }; // the next Save is a new call
      toast.success('Call saved');
      onSaved?.(call);
      void reload(target.type === 'lead' ? ['leads', 'comments', 'reports'] : ['coldCalls', 'comments', 'reports']);
    } catch (error) {
      // the form keeps what was typed; the same request id is reused, so trying again never creates a second call
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors);
      toast.error(`The call was NOT saved: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const req = lead?.requirements;
  const shownChoice = (list: { value: string; label: string }[], value?: string | null) =>
    value ? choiceLabel(list, value) : <span className="font-normal text-gray-400">Not set on the lead</span>;
  const call = telHref(target.phone);
  const chat = whatsappHref(target.whatsapp || target.phone);

  return (
    <Dialog open onOpenChange={(open) => !saving && onOpenChange(open)}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto" data-testid="call-action">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            {saved ? 'Call saved' : 'Call Action'}
          </DialogTitle>
          <DialogDescription>
            {target.type === 'lead' ? 'Lead' : 'Cold call'}: <strong>{target.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {saved ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                Saved as call <strong>#{saved.id}</strong>. It is in <strong>Call History</strong>, in this {target.type === 'lead' ? "lead's" : "cold call's"} activity
                timeline and in <strong>Reports</strong>.
                {' '}The {target.type === 'lead' ? "lead's" : "cold call's"} status is now <strong>{saved.outcomeLabel}</strong>.
              </div>
            </div>
            <CallDetails call={saved} />
            <DialogFooter className="flex-wrap gap-2">
              {target.type === 'lead' && (
                <Button asChild variant="outline">
                  <Link to={`/leads/${target.id}`} onClick={() => onOpenChange(false)}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open lead
                  </Link>
                </Button>
              )}
              <Button variant="outline" onClick={reset}>Log another call</Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm">
              <span className="font-medium" dir="ltr">{target.phone || 'No phone number'}</span>
              {call && (
                <Button asChild size="sm" variant="outline">
                  <a href={call}><Phone className="mr-1 h-4 w-4 text-green-600" />Call</a>
                </Button>
              )}
              {chat && (
                <Button asChild size="sm" variant="outline">
                  <a href={chat} target="_blank" rel="noreferrer noopener"><MessageCircle className="mr-1 h-4 w-4 text-green-600" />WhatsApp</a>
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Choice
                id="ca-outcome"
                label="Call outcome *"
                value={form.statusId}
                error={errors.statusId}
                options={statuses.map((s) => ({ value: String(s.id), label: s.name }))}
                placeholder="Select outcome"
                hint={`Becomes the ${target.type === 'lead' ? "lead's" : "cold call's"} status`}
                unavailable={!statuses.length ? 'The outcomes (statuses) could not be loaded from the server.' : undefined}
                onRetry={() => void reload(['statuses'])}
                onChange={(v) => set('statusId', v)}
              />
              <div className="space-y-1">
                <Label htmlFor="ca-follow-up">Follow-up (optional)</Label>
                <Input id="ca-follow-up" type="datetime-local" value={form.followUpAt} aria-invalid={Boolean(errors.followUpAt)} onChange={(e) => set('followUpAt', e.target.value)} />
                {errors.followUpAt && <p className="text-xs text-red-600" role="alert">{errors.followUpAt}</p>}
              </div>
            </div>

            {target.type === 'lead' && (
              <section className="rounded-lg border border-gray-200 p-3" aria-label="Lead requirements" data-testid="call-lead-requirements">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">Lead requirements (saved on the lead)</h3>
                  <Button type="button" size="sm" variant="outline" disabled={!lead} onClick={() => setEditingLead(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit lead requirements
                  </Button>
                </div>
                {leadError ? (
                  <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-700">
                    <span className="flex-1">Could not load the lead: {leadError}</span>
                    <Button type="button" size="sm" variant="outline" disabled={leadLoading} onClick={() => void loadLead()}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${leadLoading ? 'animate-spin' : ''}`} /> Retry
                    </Button>
                  </div>
                ) : !lead ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : (
                  <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                    <div><dt className="text-gray-500">Delivery</dt><dd className="font-medium" data-testid="req-delivery">{shownChoice(leadOptions.delivery, req?.delivery)}</dd></div>
                    <div><dt className="text-gray-500">Finishing</dt><dd className="font-medium" data-testid="req-finishing">{shownChoice(leadOptions.finishing, req?.finishing)}</dd></div>
                    <div><dt className="text-gray-500">Purpose of purchase</dt><dd className="font-medium" data-testid="req-purpose">{shownChoice(leadOptions.purpose, req?.purpose)}</dd></div>
                  </dl>
                )}
              </section>
            )}
            <div className="space-y-1">
              <Label htmlFor="ca-notes">Call notes</Label>
              <Textarea id="ca-notes" rows={3} maxLength={5000} value={form.notes} placeholder="What did the client say?" onChange={(e) => set('notes', e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save call'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
      {leadId !== null && (
        <LeadFormDialog
          open={editingLead}
          onOpenChange={setEditingLead}
          leadId={leadId}
          focusRequirements
          onSaved={(saved) => setLead(saved)}
        />
      )}
    </Dialog>
  );
}

function Choice({ id, label, value, options, placeholder, error, hint, unavailable, onRetry, onChange }: {
  id: string; label: string; value: string; options: { value: string; label: string }[]; placeholder: string; error?: string; hint?: string;
  unavailable?: string; onRetry?: () => void; onChange: (v: string) => void;
}) {
  if (unavailable) {
    // never render an empty dropdown (nothing to pick, and it traps the keyboard focus) - say why and offer Retry
    return (
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <div role="alert" className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="flex-1">{unavailable}</span>
          {onRetry && <Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry</Button>}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full" aria-label={label.replace(' *', '')} aria-invalid={Boolean(error)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {error ? <p className="text-xs text-red-600" role="alert">{error}</p> : hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}
