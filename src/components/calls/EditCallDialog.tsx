import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError, errorMessage } from '@/lib/api';
import { jsonRequest } from '@/lib/mutations';
import { savedItem } from '@/lib/saved';
import type { CallRecord } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * Correct the notes of a saved call (PUT /api/call-actions/:id). A saved call is history: its outcome changed the
 * record's status at that moment (log a new call for a new outcome), and requirements are edited on the lead.
 */
export function EditCallDialog({ call, onClose, onSaved }: { call: CallRecord | null; onClose: () => void; onSaved: (call: CallRecord) => void }) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  if (call && loadedFor !== call.id) {
    setLoadedFor(call.id);
    setNotes(call.notes);
    setError('');
  }
  if (!call) return null;

  const save = async () => {
    setSaving(true);
    try {
      const result = await jsonRequest<{ item: CallRecord }>(`call-actions/${call.id}`, { method: 'PUT', body: { notes: notes.trim() } });
      const saved = savedItem<CallRecord>(result);
      if (!saved) throw new Error('The server did not confirm the change');
      toast.success(`Call #${call.id} updated`);
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.notes) setError(err.fieldErrors.notes);
      toast.error(`Not saved: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit notes of call #{call.id}</DialogTitle>
          <DialogDescription>
            {call.entityName} - {call.outcomeLabel || 'no outcome'} - logged by {call.userName}. The outcome is part of the history; log a new call to record a new one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="ec-notes">Call notes</Label>
          <Textarea id="ec-notes" rows={4} maxLength={5000} value={notes} aria-invalid={Boolean(error)} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? 'Saving...' : 'Save notes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
