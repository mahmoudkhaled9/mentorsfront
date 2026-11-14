import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, MessageSquare, PhoneCall, RefreshCw } from 'lucide-react';
import { apiFetch, errorMessage, readApiError } from '@/lib/api';
import { jsonRequest } from '@/lib/mutations';
import { savedItem } from '@/lib/saved';
import { useData } from '@/contexts/DataContext';
import type { Comment, RecordActivity } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CallDetails } from './CallDetails';

interface Props {
  entityType: 'lead' | 'cold_call';
  entityId: number;
  /** Bump to reload (e.g. after a call was logged elsewhere on the page). */
  refreshKey?: number;
}

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

/** Everything that happened on one lead / cold call, newest first, read from GET /api/{leads|cold-calls}/:id/activity. */
export function ActivityTimeline({ entityType, entityId, refreshKey = 0 }: Props) {
  const { setComments, reload } = useData();
  const [data, setData] = useState<RecordActivity | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const base = entityType === 'lead' ? 'leads' : 'cold-calls';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`${base}/${entityId}/activity`);
      if (!response.ok) throw await readApiError(response);
      setData((await response.json()) as RecordActivity);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [base, entityId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const addComment = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const result = await jsonRequest<{ item: Comment }>('comments', { method: 'POST', body: { entityType, entityId, content: text.trim() } });
      const saved = savedItem<Comment>(result);
      if (saved) setComments((prev) => [...prev, saved]);
      setText('');
      toast.success('Comment added');
      void reload(['reports']);
      await load();
    } catch (err) {
      toast.error(`The comment was NOT saved: ${errorMessage(err)}`);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="activity-timeline">
      <div className="space-y-2">
        <Textarea aria-label="New comment" placeholder="Add a comment to the history" maxLength={5000} rows={2} value={text} onChange={(e) => setText(e.target.value)} />
        <Button size="sm" onClick={() => void addComment()} disabled={!text.trim() || posting}>{posting ? 'Saving...' : 'Add Comment'}</Button>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span className="flex-1">Could not load the history: {error}</span>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Retry
          </Button>
        </div>
      )}
      {loading && !data && <p className="text-sm text-gray-500">Loading history...</p>}
      {data && data.timeline.length === 0 && <p className="text-sm text-gray-500">No calls or comments yet.</p>}

      <ol className="space-y-3">
        {data?.timeline.map((entry) => (
          <li key={entry.id} className="rounded-lg border p-3">
            {entry.kind === 'call' && entry.call && (
              <div>
                <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" aria-expanded={open === entry.id} onClick={() => setOpen(open === entry.id ? null : entry.id)}>
                  <PhoneCall className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Call #{entry.call.id}</span>
                  <Badge variant="secondary">{entry.call.outcomeLabel || 'No outcome'}</Badge>
                  {entry.call.deliveryLabel && <Badge variant="outline">{entry.call.deliveryLabel}</Badge>}
                  {entry.call.finishingLabel && <Badge variant="outline">{entry.call.finishingLabel}</Badge>}
                  {entry.call.purposeLabel && <Badge variant="outline">{entry.call.purposeLabel}</Badge>}
                  <span className="ml-auto text-xs text-gray-500">{entry.call.userName} - {when(entry.at)}</span>
                </button>
                {entry.call.notes && open !== entry.id && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{entry.call.notes}</p>}
                {open === entry.id && <div className="mt-3"><CallDetails call={entry.call} /></div>}
              </div>
            )}
            {entry.kind === 'comment' && entry.comment && (
              <div className="flex gap-2">
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{entry.comment.content}</p>
                  <p className="mt-1 text-xs text-gray-500">{entry.comment.createdBy} - {when(entry.at)}</p>
                </div>
              </div>
            )}
            {entry.kind === 'follow_up' && entry.followUp && (
              <div className="flex gap-2 text-sm">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span><strong>Follow-up</strong> scheduled for {when(entry.followUp.startAt)}{entry.followUp.notes ? ` - ${entry.followUp.notes}` : ''}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
