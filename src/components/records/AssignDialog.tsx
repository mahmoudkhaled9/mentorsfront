import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { User } from '@/types';
import { roleLabel } from '@/lib/roles';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  noun: string;
  users: User[];
  busy?: boolean;
  onAssign: (userId: number) => void | Promise<void>;
}

/** Pick one person to own the selected records. The server decides the team leader from the org chart. */
export function AssignDialog({ open, onOpenChange, count, noun, users, busy = false, onAssign }: Props) {
  const [userId, setUserId] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) setUserId('');
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {count} {noun}</DialogTitle>
          <DialogDescription>The selected {noun} move to this person. Their team leader is set automatically.</DialogDescription>
        </DialogHeader>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger aria-label="Assign to">
            <SelectValue placeholder="Select a person" />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>
                {u.name} <span className="text-gray-500">({roleLabel(u.role)})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!users.length && <p className="text-sm text-gray-500">There is nobody in your team to assign to.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button
            disabled={!userId || busy}
            onClick={async () => {
              await onAssign(Number(userId));
              setUserId('');
            }}
          >
            {busy ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
