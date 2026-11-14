import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Pencil, PhoneCall, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/contexts/DataContext';
import { apiFetch, errorMessage, readApiError } from '@/lib/api';
import { isSuperRole } from '@/lib/roles';
import { pageCount } from '@/lib/table';
import type { ExportRow } from '@/lib/exporters';
import type { CallRecord } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CallDetails } from '@/components/calls/CallDetails';
import { EditCallDialog } from '@/components/calls/EditCallDialog';
import { ExportButtons } from '@/components/records/ExportButtons';
import { TablePagination } from '@/components/records/TablePagination';

const when = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

/** Every logged call the user may see (GET /api/call-actions), newest first. */
export default function CallHistory() {
  const { user } = useAuth();
  const { statuses, users } = useData();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('all');
  const [agent, setAgent] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<CallRecord | null>(null);
  const [editing, setEditing] = useState<CallRecord | null>(null);
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '2000' });
      if (outcome !== 'all') qs.set('statusId', outcome);
      if (agent !== 'all') qs.set('userId', agent);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const response = await apiFetch(`call-actions?${qs}`);
      if (!response.ok) throw await readApiError(response);
      setCalls((await response.json()) as CallRecord[]);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [outcome, agent, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const term = search.trim().toLowerCase();
  const filtered = useMemo(
    () => (term ? calls.filter((c) => `${c.entityName} ${c.entityPhone} ${c.userName} ${c.notes}`.toLowerCase().includes(term)) : calls),
    [calls, term]
  );
  const safePage = Math.min(page, pageCount(filtered.length, pageSize));
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const canEdit = (c: CallRecord) => isSuperRole(user?.role) || c.userId === user?.id;
  const changed = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  const exportRows = (): ExportRow[] => filtered.map((c) => ({
    Call: c.id, Date: when(c.callAt), Client: c.entityName, Type: c.entityType === 'lead' ? 'Lead' : 'Cold call', Phone: c.entityPhone,
    'Logged by': c.userName, Outcome: c.outcomeLabel, 'Follow-up': when(c.followUpAt), Notes: c.notes,
    'Delivery (at call time)': c.deliveryLabel ?? '', 'Finishing (at call time)': c.finishingLabel ?? '', 'Purpose (at call time)': c.purposeLabel ?? '',
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><PhoneCall className="h-6 w-6" /> Call History</h1>
        <Badge variant="secondary" className="text-lg" data-testid="calls-count">{filtered.length}</Badge>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label htmlFor="ch-search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input id="ch-search" className="pl-9" placeholder="Client, phone, agent, notes" value={search} onChange={(e) => changed(setSearch)(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Outcome</Label>
            <Select value={outcome} onValueChange={changed(setOutcome)}>
              <SelectTrigger aria-label="Filter by outcome"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                {statuses.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Logged by</Label>
            <Select value={agent} onValueChange={changed(setAgent)}>
              <SelectTrigger aria-label="Filter by agent"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ch-from">From</Label>
            <Input id="ch-from" type="date" value={from} onChange={(e) => changed(setFrom)(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ch-to">To</Label>
            <Input id="ch-to" type="date" value={to} onChange={(e) => changed(setTo)(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2 lg:col-span-5">
            <ExportButtons rows={exportRows} scopeLabel="call(s)" title="Call History" baseName="call-history" />
            <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span className="flex-1">Could not load the call history: {error}</span>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Logged by</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-gray-500">
                      {loading ? 'Loading calls...' : calls.length ? 'No calls match the filters.' : 'No calls logged yet. Use "Log call" on a lead or cold call.'}
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">{when(c.callAt)}</TableCell>
                    <TableCell>
                      {c.entityType === 'lead' && c.leadId ? (
                        <Link to={`/leads/${c.leadId}`} className="font-medium hover:underline">{c.entityName}</Link>
                      ) : (
                        <span className="font-medium">{c.entityName}</span>
                      )}
                      <div className="text-xs text-gray-500">{c.entityType === 'lead' ? 'Lead' : 'Cold call'}</div>
                    </TableCell>
                    <TableCell>{c.userName}</TableCell>
                    <TableCell>{c.outcomeLabel || '-'}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={c.notes}>{c.notes || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`View call ${c.id}`} onClick={() => setViewing(c)}><Eye className="h-4 w-4" /></Button>
                        {canEdit(c) && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit call ${c.id}`} onClick={() => setEditing(c)}><Pencil className="h-4 w-4 text-green-600" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination page={safePage} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
        </CardContent>
      </Card>

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Call #{viewing?.id}</DialogTitle></DialogHeader>
          {viewing && <CallDetails call={viewing} />}
        </DialogContent>
      </Dialog>
      <EditCallDialog call={editing} onClose={() => setEditing(null)} onSaved={(saved) => setCalls((prev) => prev.map((c) => (c.id === saved.id ? saved : c)))} />
    </div>
  );
}
