import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, Layers, PhoneCall, RefreshCw, Undo2, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { errorMessage } from '@/lib/api';
import { jsonRequest } from '@/lib/mutations';
import { roleLabel } from '@/lib/roles';
import { pageCount } from '@/lib/table';
import type { ExportRow } from '@/lib/exporters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ExportButtons } from '@/components/records/ExportButtons';
import { TablePagination } from '@/components/records/TablePagination';

/*
 * Number Pool. Everything shown here comes from /api/pool/*, which already limits every list, detail, report and export
 * to the signed-in user + the people below them in the reporting tree. The page never filters other people's data out.
 */
type Requirements = {
  destination: string | null; propertyType: string | null; budgetMin: number | null; budgetMax: number | null;
  delivery: string | null; deliveryLabel: string | null; finishing: string | null; finishingLabel: string | null;
  purpose: string | null; purposeLabel: string | null; downPayment: number | null; installment: number | null;
  original: Record<string, string>;
};
type PoolItem = {
  id: number; batchId: number; numberId: number; userId: number; userName: string | null; allocatedAt: string | null;
  endedAt: string | null; state: 'open' | 'processed' | 'released' | 'cancelled'; outcome: string | null; outcomeLabel: string | null;
  notes: string | null; endedById: number | null; endedByName: string | null; leadId: number | null; coldCallId: number | null;
  name: string | null; phone: string | null; numberNotes: string | null; requirements: Requirements; history?: PoolItem[];
};
type Batch = {
  id: number; userId: number; userName: string | null; sizeRequested: number; sizeAllocated: number;
  status: 'active' | 'completed' | 'cancelled'; createdAt: string | null; completedAt: string | null; cancelledAt: string | null;
  counts: { open: number; processed: number; released: number }; items?: PoolItem[];
};
type Me = {
  isAgent: boolean; canRequest: boolean; sizes: number[]; outcomes: { value: string; label: string }[]; available: number;
  activeBatch: Batch | null; teamSize: number; canSeeSummary: boolean; canImport: boolean;
};
type ReportRow = {
  userId: number; userName: string; role: string; managerName: string | null; allocated: number; processed: number; open: number;
  released: number; batches: number; outcomes: Record<string, number>; completionRate: number; conversionRate: number;
};
type Report = { rows: ReportRow[]; totals: Omit<ReportRow, 'userId' | 'userName' | 'role' | 'managerName'> };
type Summary = {
  numbers: { available: number; allocated: number; processed: number; total: number };
  batches: Record<string, number>; outcomes: Record<string, number>;
  imports: { id: number; fileName: string | null; rowCount: number; available: number; createdAt: string | null; uploadedBy: string | null }[];
};
type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '');
const money = (n: number | null) => (n === null || n === undefined ? '' : n.toLocaleString('en-US'));
const budget = (r: Requirements) => (r.budgetMin !== null || r.budgetMax !== null ? [money(r.budgetMin), money(r.budgetMax)].filter(Boolean).join(' - ') : '');
const STATE_STYLE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800', processed: 'bg-green-100 text-green-800', released: 'bg-gray-100 text-gray-700', cancelled: 'bg-red-100 text-red-700',
};
const STATE_LABEL: Record<string, string> = { open: 'To call', processed: 'Done', released: 'Handed back', cancelled: 'Batch cancelled' };
const BATCH_STYLE: Record<string, string> = { active: 'bg-blue-100 text-blue-800', completed: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-700' };

const exportRow = (i: PoolItem): ExportRow => ({
  Agent: i.userName ?? '', Batch: i.batchId, Name: i.name ?? '', Phone: i.phone ?? '',
  Destination: i.requirements.destination ?? '', Budget: budget(i.requirements), 'Property Type': i.requirements.propertyType ?? '',
  Delivery: i.requirements.deliveryLabel ?? i.requirements.delivery ?? '', Finishing: i.requirements.finishingLabel ?? i.requirements.finishing ?? '',
  Purpose: i.requirements.purposeLabel ?? i.requirements.purpose ?? '', 'Down Payment': money(i.requirements.downPayment),
  Installments: money(i.requirements.installment), Allocated: when(i.allocatedAt), State: STATE_LABEL[i.state] ?? i.state,
  Result: i.outcomeLabel ?? '', Notes: i.notes ?? '',
});

function StateBadge({ state }: { state: string }) {
  return <Badge className={STATE_STYLE[state] ?? ''} variant="secondary">{STATE_LABEL[state] ?? state}</Badge>;
}

function RequirementsView({ item }: { item: PoolItem }) {
  const r = item.requirements;
  const rows: [string, string][] = [
    ['Destination', r.destination ?? ''], ['Budget', budget(r)], ['Property type', r.propertyType ?? ''],
    ['Delivery', r.deliveryLabel ?? r.delivery ?? ''], ['Finishing', r.finishingLabel ?? r.finishing ?? ''],
    ['Purpose of purchase', r.purposeLabel ?? r.purpose ?? ''], ['Down payment', money(r.downPayment)], ['Installments', money(r.installment)],
  ];
  const extra = Object.entries(r.original ?? {});
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b py-1">
            <dt className="text-gray-500">{k}</dt>
            <dd className="font-medium text-right">{v || <span className="text-gray-400">Not provided</span>}</dd>
          </div>
        ))}
      </dl>
      {item.numberNotes && <p><span className="text-gray-500">Upload notes:</span> {item.numberNotes}</p>}
      {extra.length > 0 && (
        <details>
          <summary className="cursor-pointer text-gray-600">All uploaded columns ({extra.length})</summary>
          <dl className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {extra.map(([k, v]) => <div key={k}><dt className="inline text-gray-500">{k}: </dt><dd className="inline">{v}</dd></div>)}
          </dl>
        </details>
      )}
    </div>
  );
}

function NumberDialog({ itemId, onClose }: { itemId: number | null; onClose: () => void }) {
  const [loaded, setLoaded] = useState<PoolItem | null>(null);
  useEffect(() => {
    if (!itemId) return;
    jsonRequest<PoolItem>(`pool/items/${itemId}`).then(setLoaded).catch((err) => { toast.error(errorMessage(err)); onClose(); });
  }, [itemId, onClose]);
  const item = loaded && loaded.id === itemId ? loaded : null;
  return (
    <Dialog open={itemId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? `${item.name} · ${item.phone}` : 'Loading...'}</DialogTitle></DialogHeader>
        {item && (
          <div className="space-y-5">
            <p className="text-sm text-gray-600">
              Assigned to <strong>{item.userName}</strong> in batch #{item.batchId} on {when(item.allocatedAt)}. <StateBadge state={item.state} />
              {item.outcomeLabel && <> Result: <strong>{item.outcomeLabel}</strong>.</>}
              {item.leadId && <> <Link className="text-blue-600 underline" to={`/leads/${item.leadId}`}>Open lead</Link></>}
            </p>
            <RequirementsView item={item} />
            {item.history && item.history.length > 0 && (
              <div>
                <h3 className="mb-2 font-semibold">Allocation history</h3>
                <ul className="space-y-1 text-sm">
                  {item.history.map((h) => (
                    <li key={h.id} className="rounded border px-3 py-2">
                      Batch #{h.batchId} · {h.userName} · {when(h.allocatedAt)} · <StateBadge state={h.state} />
                      {h.endedAt && <> · {when(h.endedAt)}{h.endedByName ? ` by ${h.endedByName}` : ''}</>}
                      {h.outcomeLabel && <> · {h.outcomeLabel}</>}
                      {h.notes && <div className="text-gray-600">{h.notes}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProcessDialog({ item, outcomes, onClose, onDone }: { item: PoolItem | null; outcomes: Me['outcomes']; onClose: () => void; onDone: () => void }) {
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setOutcome(''); setNotes(''); }, [item]);
  const save = async () => {
    if (!item || !outcome) { toast.error('Choose the call result'); return; }
    setSaving(true);
    try {
      const r = await jsonRequest<{ leadId: number | null; coldCallId: number | null }>(`pool/items/${item.id}/process`, { method: 'POST', body: { outcome, notes: notes || undefined } });
      toast.success(r.leadId ? 'Saved - a lead was created for you' : r.coldCallId ? 'Saved - a cold call was created for you' : 'Result saved');
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Call result · {item?.name} · {item?.phone}</DialogTitle></DialogHeader>
        {item && <RequirementsView item={item} />}
        <div className="space-y-3">
          <div>
            <Label htmlFor="pool-outcome">Result</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger id="pool-outcome"><SelectValue placeholder="Choose the result of the call" /></SelectTrigger>
              <SelectContent>{outcomes.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pool-notes">Notes</Label>
            <Textarea id="pool-notes" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="What did the client say?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !outcome}>{saving ? 'Saving...' : 'Save result'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemsTable({ items, showAgent, onView, onProcess }: { items: PoolItem[]; showAgent: boolean; onView: (id: number) => void; onProcess?: (i: PoolItem) => void }) {
  if (!items.length) return <p className="p-6 text-center text-sm text-gray-500">No numbers to show.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {showAgent && <TableHead>Agent</TableHead>}
            <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Destination</TableHead><TableHead>Budget</TableHead>
            <TableHead>Property type</TableHead><TableHead>Delivery</TableHead><TableHead>Finishing</TableHead><TableHead>Purpose</TableHead>
            <TableHead>Down payment</TableHead><TableHead>Installments</TableHead><TableHead>State</TableHead><TableHead>Result</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i) => (
            <TableRow key={i.id} data-testid="pool-item-row">
              {showAgent && <TableCell>{i.userName}</TableCell>}
              <TableCell className="font-medium">{i.name}</TableCell>
              <TableCell><a className="text-blue-600" href={`tel:${i.phone}`}>{i.phone}</a></TableCell>
              <TableCell>{i.requirements.destination}</TableCell>
              <TableCell className="whitespace-nowrap">{budget(i.requirements)}</TableCell>
              <TableCell>{i.requirements.propertyType}</TableCell>
              <TableCell>{i.requirements.deliveryLabel ?? i.requirements.delivery}</TableCell>
              <TableCell>{i.requirements.finishingLabel ?? i.requirements.finishing}</TableCell>
              <TableCell>{i.requirements.purposeLabel ?? i.requirements.purpose}</TableCell>
              <TableCell>{money(i.requirements.downPayment)}</TableCell>
              <TableCell>{money(i.requirements.installment)}</TableCell>
              <TableCell><StateBadge state={i.state} /></TableCell>
              <TableCell>{i.outcomeLabel}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Button variant="ghost" size="sm" onClick={() => onView(i.id)} aria-label={`Details of ${i.name}`}><Eye className="h-4 w-4" /></Button>
                {onProcess && i.state === 'open' && (
                  <Button size="sm" onClick={() => onProcess(i)}><PhoneCall className="mr-1 h-4 w-4" />Result</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
function HistoryTab({ people, onView }: { people: ReportRow[]; onView: (id: number) => void }) {
  const [data, setData] = useState<Page<PoolItem>>({ items: [], total: 0, page: 1, pageSize: 25 });
  const [agent, setAgent] = useState('all');
  const [state, setState] = useState('all');
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [loadedKey, setLoadedKey] = useState('');
  useEffect(() => { const t = setTimeout(() => { setSearch(typed); setPage(1); }, 300); return () => clearTimeout(t); }, [typed]);
  const filter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const pageSize = 25;
  const query = useCallback((size: number, p: number) => {
    const qs = new URLSearchParams({ page: String(p), pageSize: String(size) });
    if (agent !== 'all') qs.set('userId', agent);
    if (state !== 'all') qs.set('state', state);
    if (search.trim()) qs.set('q', search.trim());
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    return `pool/items?${qs}`;
  }, [agent, state, search, from, to]);
  const key = query(pageSize, page);
  useEffect(() => {
    let alive = true;
    jsonRequest<Page<PoolItem>>(key)
      .then((d) => { if (alive) { setData(d); setLoadedKey(key); } })
      .catch((err) => toast.error(errorMessage(err)));
    return () => { alive = false; };
  }, [key]);
  const loading = loadedKey !== key;
  // exports: every row matching the filters (up to 5000), fetched from the same scoped endpoint when the button is used
  const exportRows = async () => (await jsonRequest<Page<PoolItem>>(query(5000, 1))).items.map(exportRow);
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Input placeholder="Search name or phone" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Search numbers" />
          <Select value={agent} onValueChange={filter(setAgent)}>
            <SelectTrigger aria-label="Agent"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone I can see</SelectItem>
              {people.map((p) => <SelectItem key={p.userId} value={String(p.userId)}>{p.userName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={state} onValueChange={filter(setState)}>
            <SelectTrigger aria-label="State"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {Object.entries(STATE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => filter(setFrom)(e.target.value)} aria-label="Allocated from" />
          <Input type="date" value={to} onChange={(e) => filter(setTo)(e.target.value)} aria-label="Allocated to" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-500">{loading ? 'Loading...' : `${data.total} number(s)`}</p>
          <ExportButtons rows={exportRows} scopeLabel="numbers" title="Number Pool history" baseName="number-pool-history" />
        </div>
        <ItemsTable items={data.items} showAgent onView={onView} />
        <TablePagination page={Math.min(page, pageCount(data.total, pageSize))} pageSize={pageSize} total={data.total} onPageChange={setPage} />
      </CardContent>
    </Card>
  );
}

function BatchesTab({ meId, people, onView, onChanged }: { meId: number; people: ReportRow[]; onView: (id: number) => void; onChanged: () => void }) {
  const [data, setData] = useState<Page<Batch>>({ items: [], total: 0, page: 1, pageSize: 25 });
  const [agent, setAgent] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Batch | null>(null);
  const [busy, setBusy] = useState(false);
  const pageSize = 25;
  const load = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (agent !== 'all') qs.set('userId', agent);
    if (status !== 'all') qs.set('status', status);
    try { setData(await jsonRequest<Page<Batch>>(`pool/batches?${qs}`)); } catch (err) { toast.error(errorMessage(err)); }
  }, [agent, status, page]);
  useEffect(() => { void load(); }, [load]);
  const show = async (id: number) => {
    try { setOpen(await jsonRequest<Batch>(`pool/batches/${id}`)); } catch (err) { toast.error(errorMessage(err)); }
  };
  const act = async (kind: 'release' | 'cancel') => {
    if (!open) return;
    const question = kind === 'cancel'
      ? `Cancel batch #${open.id}? Its ${open.counts.open} uncalled number(s) go back to the pool. Results already recorded are kept.`
      : `Hand the ${open.counts.open} uncalled number(s) of batch #${open.id} back to the pool?`;
    if (!window.confirm(question)) return;
    setBusy(true);
    try {
      const r = await jsonRequest<{ count: number; item: Batch }>(`pool/batches/${open.id}/${kind}`, { method: 'POST', body: {} });
      toast.success(`${r.count} number(s) handed back to the pool`);
      setOpen(r.item);
      await load();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const canManage = open && open.userId !== meId && open.status === 'active' && open.counts.open > 0;
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select value={agent} onValueChange={(v) => { setAgent(v); setPage(1); }}>
            <SelectTrigger aria-label="Agent"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone I can see</SelectItem>
              {people.map((p) => <SelectItem key={p.userId} value={String(p.userId)}>{p.userName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger aria-label="Batch status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All batches</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {data.items.length === 0 ? <p className="p-6 text-center text-sm text-gray-500">No batches to show.</p> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Batch</TableHead><TableHead>Agent</TableHead><TableHead>Requested</TableHead><TableHead>Numbers</TableHead>
                <TableHead>To call</TableHead><TableHead>Done</TableHead><TableHead>Handed back</TableHead><TableHead>Status</TableHead><TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {data.items.map((b) => (
                  <TableRow key={b.id} data-testid="pool-batch-row">
                    <TableCell>#{b.id}</TableCell><TableCell>{b.userName}</TableCell><TableCell>{when(b.createdAt)}</TableCell>
                    <TableCell>{b.sizeAllocated}{b.sizeAllocated < b.sizeRequested ? ` of ${b.sizeRequested}` : ''}</TableCell>
                    <TableCell>{b.counts.open}</TableCell><TableCell>{b.counts.processed}</TableCell><TableCell>{b.counts.released}</TableCell>
                    <TableCell><Badge variant="secondary" className={BATCH_STYLE[b.status]}>{b.status}</Badge></TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => show(b.id)}>Open</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <TablePagination page={Math.min(page, pageCount(data.total, pageSize))} pageSize={pageSize} total={data.total} onPageChange={setPage} />
      </CardContent>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Batch #{open?.id} · {open?.userName}</DialogTitle></DialogHeader>
          {open && (
            <>
              <p className="text-sm text-gray-600">
                Requested {when(open.createdAt)} · <Badge variant="secondary" className={BATCH_STYLE[open.status]}>{open.status}</Badge>
                {' '}· {open.counts.open} to call · {open.counts.processed} done · {open.counts.released} handed back
              </p>
              <ItemsTable items={open.items ?? []} showAgent={false} onView={onView} />
              {canManage && (
                <DialogFooter>
                  <Button variant="outline" disabled={busy} onClick={() => act('release')}><Undo2 className="mr-2 h-4 w-4" />Hand back uncalled numbers</Button>
                  <Button variant="destructive" disabled={busy} onClick={() => act('cancel')}><XCircle className="mr-2 h-4 w-4" />Cancel batch</Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ReportTab({ report, from, to, setFrom, setTo }: { report: Report | null; from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void }) {
  const rows = report?.rows ?? [];
  const asExport = (): ExportRow[] => rows.map((r) => ({
    Person: r.userName, Role: roleLabel(r.role), Manager: r.managerName ?? '', Batches: r.batches, Allocated: r.allocated, Done: r.processed,
    'To call': r.open, 'Handed back': r.released, Leads: r.outcomes.lead ?? 0, 'Cold calls': r.outcomes.cold_call ?? 0,
    'No answer': r.outcomes.no_answer ?? 0, 'Not interested': r.outcomes.not_interested ?? 0, 'Wrong number': r.outcomes.wrong_number ?? 0,
    'Completion %': r.completionRate, 'Conversion %': r.conversionRate,
  }));
  const t = report?.totals;
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><Label htmlFor="pool-report-from">From</Label><Input id="pool-report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label htmlFor="pool-report-to">To</Label><Input id="pool-report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="ml-auto"><ExportButtons rows={asExport} scopeLabel="rows" title="Number Pool report" baseName="number-pool-report" /></div>
        </div>
        {t && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {[['Allocated', t.allocated], ['Done', t.processed], ['To call', t.open], ['Handed back', t.released], ['Completion', `${t.completionRate}%`], ['Conversion to lead', `${t.conversionRate}%`]].map(([k, v]) => (
              <div key={String(k)} className="rounded-lg border p-3"><p className="text-xs text-gray-500">{k}</p><p className="text-xl font-semibold">{v}</p></div>
            ))}
          </div>
        )}
        {rows.length === 0 ? <p className="p-6 text-center text-sm text-gray-500">No pool activity in this period.</p> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Person</TableHead><TableHead>Manager</TableHead><TableHead>Batches</TableHead><TableHead>Allocated</TableHead><TableHead>Done</TableHead>
                <TableHead>To call</TableHead><TableHead>Handed back</TableHead><TableHead>Leads</TableHead><TableHead>Cold calls</TableHead><TableHead>Completion</TableHead><TableHead>Conversion</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.userId} data-testid="pool-report-row">
                    <TableCell className="font-medium">{r.userName} <span className="text-xs text-gray-500">{roleLabel(r.role)}</span></TableCell>
                    <TableCell>{r.managerName}</TableCell><TableCell>{r.batches}</TableCell><TableCell>{r.allocated}</TableCell><TableCell>{r.processed}</TableCell>
                    <TableCell>{r.open}</TableCell><TableCell>{r.released}</TableCell><TableCell>{r.outcomes.lead ?? 0}</TableCell><TableCell>{r.outcomes.cold_call ?? 0}</TableCell>
                    <TableCell>{r.completionRate}%</TableCell><TableCell>{r.conversionRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryTab() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => { jsonRequest<Summary>('pool/summary').then(setS).catch((err) => toast.error(errorMessage(err))); }, []);
  if (!s) return <p className="p-6 text-sm text-gray-500">Loading...</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Company-wide totals only. Individual numbers, requirements and agents' history are visible to each agent and the managers above them.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['In the pool', s.numbers.available], ['With agents', s.numbers.allocated], ['Called', s.numbers.processed], ['Active batches', s.batches.active ?? 0]].map(([k, v]) => (
          <Card key={String(k)}><CardContent className="p-4"><p className="text-xs text-gray-500">{k}</p><p className="text-2xl font-semibold">{v}</p></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Uploads</CardTitle></CardHeader>
        <CardContent>
          {s.imports.length === 0 ? <p className="text-sm text-gray-500">Nothing uploaded yet. <Link className="text-blue-600 underline" to="/admin/upload-data">Upload Data</Link> → Number Pool.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>File</TableHead><TableHead>Uploaded</TableHead><TableHead>By</TableHead><TableHead>Numbers</TableHead><TableHead>Still in the pool</TableHead></TableRow></TableHeader>
              <TableBody>
                {s.imports.map((m) => (
                  <TableRow key={m.id}><TableCell>{m.fileName ?? `Upload #${m.id}`}</TableCell><TableCell>{when(m.createdAt)}</TableCell><TableCell>{m.uploadedBy}</TableCell><TableCell>{m.rowCount}</TableCell><TableCell>{m.available}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
export default function NumberPool() {
  const { user } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const [processing, setProcessing] = useState<PoolItem | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    jsonRequest<Me>('pool/me').then((m) => { setMe(m); setError(''); }).catch((err) => setError(errorMessage(err)));
  }, [version]);
  useEffect(() => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    jsonRequest<Report>(`pool/report?${qs}`).then(setReport).catch((err) => toast.error(errorMessage(err)));
  }, [from, to, version]);

  const request = async (size: number) => {
    setRequesting(size);
    try {
      const r = await jsonRequest<{ item: Batch }>('pool/batches', { method: 'POST', body: { size } });
      toast.success(r.item.sizeAllocated < size ? `Only ${r.item.sizeAllocated} number(s) were left in the pool - they are yours` : `${r.item.sizeAllocated} numbers assigned to you`);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRequesting(0);
    }
  };
  const closeView = useCallback(() => setViewing(null), []);
  const people = useMemo(() => report?.rows ?? [], [report]);
  const hasTeam = (me?.teamSize ?? 0) > 0;

  if (error) return <div className="p-6"><p className="text-red-600" role="alert">{error}</p><Button className="mt-3" variant="outline" onClick={refresh}>Try again</Button></div>;
  if (!me || !user) return <p className="p-6 text-sm text-gray-500" role="status">Loading the Number Pool...</p>;
  const active = me.activeBatch;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Layers className="h-6 w-6" />Number Pool</h1>
          <p className="mt-1 text-gray-500">
            {me.isAgent ? 'Request numbers, call them and record the result. ' : ''}
            {hasTeam ? 'You see your own numbers and everyone who reports to you.' : me.isAgent ? 'Only you and your managers can see your numbers.' : ''}
          </p>
        </div>
        <Button variant="outline" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>

      {me.isAgent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
              <span>{active ? `My active batch #${active.id} · ${active.counts.open} to call · ${active.counts.processed} done` : 'No active batch'}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm font-normal text-gray-600">
                {me.available} number(s) waiting in the pool
                {me.sizes.map((size) => (
                  <Button key={size} size="sm" disabled={!me.canRequest || requesting > 0 || me.available === 0} onClick={() => request(size)}>
                    {requesting === size ? 'Requesting...' : `Request ${size}`}
                  </Button>
                ))}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!me.canRequest && active && active.counts.open > 0 && <p className="px-6 pb-3 text-sm text-gray-500">Record a result for every number in this batch to request the next one.</p>}
            {active ? <ItemsTable items={active.items ?? []} showAgent={false} onView={setViewing} onProcess={setProcessing} /> : <p className="p-6 text-center text-sm text-gray-500">Request 5, 10 or 20 numbers to start calling.</p>}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={me.isAgent || hasTeam ? 'history' : me.canSeeSummary ? 'summary' : 'history'}>
        <TabsList>
          <TabsTrigger value="history">{hasTeam ? 'Numbers & history' : 'My history'}</TabsTrigger>
          <TabsTrigger value="batches">{hasTeam ? 'Batches' : 'My batches'}</TabsTrigger>
          <TabsTrigger value="report">{hasTeam ? 'Team report' : 'My report'}</TabsTrigger>
          {me.canSeeSummary && <TabsTrigger value="summary">Company summary</TabsTrigger>}
        </TabsList>
        <TabsContent value="history"><HistoryTab key={version} people={people} onView={setViewing} /></TabsContent>
        <TabsContent value="batches"><BatchesTab key={version} meId={user.id} people={people} onView={setViewing} onChanged={refresh} /></TabsContent>
        <TabsContent value="report"><ReportTab report={report} from={from} to={to} setFrom={setFrom} setTo={setTo} /></TabsContent>
        {me.canSeeSummary && <TabsContent value="summary"><SummaryTab key={version} /></TabsContent>}
      </Tabs>

      <NumberDialog itemId={viewing} onClose={closeView} />
      <ProcessDialog item={processing} outcomes={me.outcomes} onClose={() => setProcessing(null)} onDone={() => { setProcessing(null); refresh(); }} />
    </div>
  );
}
