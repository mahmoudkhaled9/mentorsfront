import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props<K extends string> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: { key: K; label: string }[];
  visible: Record<K, boolean>;
  onChange: (next: Record<K, boolean>) => void;
}

/** Show/hide table columns. The choice is remembered in this browser by the caller (see usePersistentState). */
export function ColumnsDialog<K extends string>({ open, onOpenChange, columns, visible, onChange }: Props<K>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Visible Columns</DialogTitle>
          <DialogDescription>Choose which columns the table shows.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {columns.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <Checkbox checked={visible[key]} onCheckedChange={(checked) => onChange({ ...visible, [key]: Boolean(checked) })} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
