import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '@/contexts/DataContext';
import { errorMessage } from '@/lib/api';
import { jsonRequest } from '@/lib/mutations';
import { savedItem } from '@/lib/saved';
import type { Comment } from '@/types';
import { commentsFor } from '@/lib/table';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'lead' | 'cold_call';
  entityId: number | null;
  title: string;
}

const when = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
};

/** Comment history of one lead / cold call. New comments are saved by the server (author = signed-in user) and feed Reports. */
export function CommentsDialog({ open, onOpenChange, entityType, entityId, title }: Props) {
  const { comments, setComments, reload } = useData();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const list = commentsFor(comments, entityType, entityId);

  const add = async () => {
    if (!entityId || !text.trim() || saving) return;
    setSaving(true);
    try {
      const result = await jsonRequest<{ item: Comment }>('comments', { method: 'POST', body: { entityType, entityId, content: text.trim() } });
      const saved = savedItem<Comment>(result);
      if (saved) setComments((prev) => [...prev, saved]);
      else await reload(['comments']);
      setText('');
      toast.success('Comment added');
      void reload(['reports']);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Comments are visible to the team and appear in Reports.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto">
          {list.length === 0 && <p className="text-sm text-gray-500">No comments yet.</p>}
          {list.map((c) => (
            <div key={c.id} className="rounded-md bg-gray-50 p-3">
              <p className="whitespace-pre-wrap text-sm text-gray-800">{c.content}</p>
              <p className="mt-1 text-xs text-gray-500">{c.createdBy} • {when(c.createdAt)}</p>
            </div>
          ))}
        </div>
        <Textarea aria-label="New comment" placeholder="Add a comment" value={text} maxLength={5000} onChange={(e) => setText(e.target.value)} />
        <Button onClick={() => void add()} disabled={!entityId || !text.trim() || saving}>
          {saving ? 'Saving...' : 'Add Comment'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
