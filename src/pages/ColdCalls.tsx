import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/hooks/useAuth';
import { usePersistentState } from '@/hooks/usePersistentState';
import { ApiError, errorMessage } from '@/lib/api';
import { jsonRequest } from '@/lib/mutations';
import { savedId, savedItem } from '@/lib/saved';
import { checkPhone, CLIENT_PHONE_HINT } from '@/lib/phone';
import { isAssignerRole, isSuperRole } from '@/lib/roles';
import type { ExportRow } from '@/lib/exporters';
import type { Comment, Lead } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AssignDialog } from '@/components/records/AssignDialog';
import { ColumnsDialog } from '@/components/records/ColumnsDialog';
import { ConfirmDialog } from '@/components/records/ConfirmDialog';
import { ContactButtons } from '@/components/records/ContactButtons';
import { ExportButtons } from '@/components/records/ExportButtons';
import { StatusTabs } from '@/components/records/StatusTabs';
import { TablePagination } from '@/components/records/TablePagination';
import { pageCount } from '@/lib/table';
import { exportExcel } from '@/lib/exporters';
import { Plus, Search, Filter, UserPlus, Columns, Trash2, Target, XCircle, CheckCircle, Edit, FileSpreadsheet, FileText, X, PhoneCall } from 'lucide-react';
import { CallActionDialog, type CallTarget } from '@/components/calls/CallActionDialog';
import { ActivityTimeline } from '@/components/calls/ActivityTimeline';

type ColumnKey = 'id' | 'type' | 'name' | 'phone' | 'status' | 'assignedTo' | 'teamLeader' | 'potential' | 'date' | 'notes' | 'action';

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'type', label: 'Type' },
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status' },
  { key: 'assignedTo', label: 'Assigned To' },
  { key: 'teamLeader', label: 'Team Leader' },
  { key: 'potential', label: 'Potential' },
  { key: 'date', label: 'Date' },
  { key: 'notes', label: 'Notes' },
  { key: 'action', label: 'Actions' },
];

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  id: true, type: true, name: true, phone: true, status: true, assignedTo: true, teamLeader: true, potential: true, date: false, notes: false, action: true,
};

const PAGE_SIZES = [10, 25, 50, 100];

interface CallForm {
  name: string;
  phone: string;
  statusId: string;
  notes: string;
  comment: string;
}

const toExportRows = (calls: Lead[]): ExportRow[] =>
  calls.map((c) => ({
    ID: c.id,
    Name: c.name,
    Phone: c.phone,
    Status: c.status,
    'Assigned To': c.assignedTo ?? '',
    'Team Leader': c.teamLeader ?? '',
    Date: c.date ?? '',
    Potential: c.isPotential ? 'Yes' : 'No',
    Notes: c.notes ?? '',
  }));

export default function ColdCalls() {
  const { user } = useAuth();
  const { coldCalls, setColdCalls, statuses, users, setComments, reload, isLoading } = useData();
  const canAssign = isAssignerRole(user?.role);

  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('All');
  const [potential, setPotential] = useState<'all' | 'potential' | 'non-potential'>('all');
  const [selected, setSelected] = useState<number[]>([]);
  const [pageSize, setPageSize] = usePersistentState('mentors.coldcalls.pageSize', 10);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterTeamLeader, setFilterTeamLeader] = useState('all');
  const [columns, setColumns] = usePersistentState<Record<ColumnKey, boolean>>('mentors.coldcalls.columns', DEFAULT_COLUMNS);
  const [showColumns, setShowColumns] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<CallForm>({ name: '', phone: '', statusId: '', notes: '', comment: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [commentsCall, setCommentsCall] = useState<Lead | null>(null);
  const [callTarget, setCallTarget] = useState<CallTarget | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const callColdCall = (c: Lead) => setCallTarget({ type: 'cold_call', id: c.id, name: c.name, phone: c.phone, statusId: c.statusId });

  const resetView = () => {
    setPage(1);
    setSelected([]);
  };
  const changed = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    resetView();
  };

  const term = search.trim().toLowerCase();
  const termDigits = term.replace(/\D/g, '');
  const beforeStatus = useMemo(() => coldCalls.filter((c) => {
    if (term) {
      const text = `${c.name} ${c.assignedTo ?? ''} ${c.notes ?? ''}`.toLowerCase();
      const phone = (c.phone ?? '').replace(/\D/g, '');
      if (!text.includes(term) && !(termDigits.length >= 3 && phone.includes(termDigits))) return false;
    }
    if (potential === 'potential' && !c.isPotential) return false;
    if (potential === 'non-potential' && c.isPotential) return false;
    if (filterAssignee !== 'all' && String(c.assignedToId ?? '') !== filterAssignee) return false;
    if (filterTeamLeader !== 'all' && String(c.teamLeaderId ?? '') !== filterTeamLeader) return false;
    return true;
  }), [coldCalls, term, termDigits, potential, filterAssignee, filterTeamLeader]);
  const filtered = useMemo(() => (statusTab === 'All' ? beforeStatus : beforeStatus.filter((c) => c.status === statusTab)), [beforeStatus, statusTab]);
  const statusCount = (name: string) => (name === 'All' ? beforeStatus.length : beforeStatus.filter((c) => c.status === name).length);

  const pages = pageCount(filtered.length, pageSize);
  const safePage = Math.min(page, pages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((c) => selected.includes(c.id));
  const anyFilter = Boolean(term) || potential !== 'all' || filterAssignee !== 'all' || filterTeamLeader !== 'all' || statusTab !== 'All';
  const clearFilters = () => {
    setSearch('');
    setStatusTab('All');
    setPotential('all');
    setFilterAssignee('all');
    setFilterTeamLeader('all');
    resetView();
  };

  const assignableUsers = users.filter((u) => u.isActive !== false && !isSuperRole(u.role));
  const teamLeaders = users.filter((u) => u.role === 'team_leader');
  const statusColor = (name: string) => statuses.find((s) => s.name === name)?.color || '#6B7280';

  const exportRows = () => toExportRows(selected.length ? coldCalls.filter((c) => selected.includes(c.id)) : filtered);

  const exportAll = async () => {
    if (!coldCalls.length) {
      toast.error('There are no cold calls to export');
      return;
    }
    try {
      const n = await exportExcel(toExportRows(coldCalls), 'cold-calls-all', 'Cold Calls');
      toast.success(`Exported all ${n} cold calls to Excel`);
    } catch (error) {
      toast.error(`Export failed: ${errorMessage(error)}`);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', statusId: statuses[0] ? String(statuses[0].id) : '', notes: '', comment: '' });
    setFormErrors({});
    setFormOpen(true);
  };
  const openEdit = (call: Lead) => {
    setEditing(call);
    setForm({ name: call.name, phone: call.phone ?? '', statusId: call.statusId ? String(call.statusId) : '', notes: call.notes ?? '', comment: '' });
    setFormErrors({});
    setFormOpen(true);
  };
  const statusChanged = Boolean(editing) && form.statusId !== (editing?.statusId ? String(editing.statusId) : '');

  const saveCall = async () => {
    if (saving) return;
    const problems: Record<string, string> = {};
    if (!form.name.trim()) problems.name = 'Name is required';
    const phone = checkPhone(form.phone, { required: true, keep: editing?.phone });
    if (!phone.ok) problems.phone = phone.message;
    if (!form.statusId) problems.statusId = 'Choose a status';
    if (statusChanged && !form.comment.trim()) problems.comment = 'Add a comment explaining the status change';
    setFormErrors(problems);
    if (Object.keys(problems).length || !phone.ok) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    setSaving(true);
    try {
      const body = { name: form.name.trim(), phone: phone.value, statusId: Number(form.statusId), notes: form.notes.trim() };
      const result = editing
        ? await jsonRequest<{ item: Lead }>(`cold-calls/${editing.id}`, { method: 'PUT', body })
        : await jsonRequest<{ item: Lead }>('cold-calls', { method: 'POST', body });
      const saved = savedItem<Lead>(result);
      const savedRecordId = saved?.id ?? savedId(result) ?? editing?.id ?? null;
      if (saved) setColdCalls((prev) => (editing ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved]));
      else await reload(['coldCalls']); // unexpected answer shape: show what the server has
      if (form.comment.trim() && savedRecordId) {
        try {
          const comment = await jsonRequest<{ item: Comment }>('comments', { method: 'POST', body: { entityType: 'cold_call', entityId: savedRecordId, content: form.comment.trim() } });
          const savedComment = savedItem<Comment>(comment);
          if (savedComment) setComments((prev) => [...prev, savedComment]);
          else void reload(['comments']);
        } catch (error) {
          toast.error(`The cold call was saved, but the comment was not: ${errorMessage(error)}`);
        }
      }
      void reload(['reports']);
      toast.success(editing ? 'Cold call updated' : 'Cold call added');
      setFormOpen(false);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setFormErrors((prev) => ({ ...prev, ...error.fieldErrors }));
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const assignSelected = async (userId: number) => {
    setAssigning(true);
    try {
      const result = await jsonRequest<{ count: number }>('cold-calls/bulk-assign', { method: 'POST', body: { ids: selected, assignedToId: userId } });
      await reload(['coldCalls']);
      toast.success(`Assigned ${result.count} cold call(s) to ${users.find((u) => u.id === userId)?.name ?? 'the selected user'}`);
      setSelected([]);
      setAssignOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAssigning(false);
    }
  };

  const deleteSelected = async () => {
    setDeleting(true);
    try {
      const result = await jsonRequest<{ count: number }>('cold-calls/bulk-delete', { method: 'POST', body: { ids: selected } });
      setColdCalls((prev) => prev.filter((c) => !selected.includes(c.id)));
      toast.success(`Deleted ${result.count} cold call(s)`);
      setSelected([]);
      setConfirmDelete(false);
      void reload(['reports', 'comments']);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const toggle = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const togglePage = () =>
    setSelected((prev) => (allOnPageSelected ? prev.filter((id) => !pageRows.some((c) => c.id === id)) : [...new Set([...prev, ...pageRows.map((c) => c.id)])]));
  const visibleColumnCount = 1 + COLUMNS.filter((c) => columns[c.key]).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Cold Calls List</h1>
          <Badge variant="secondary" className="text-lg" data-testid="coldcalls-count">{filtered.length}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={showFilters ? 'default' : 'outline'} aria-expanded={showFilters} onClick={() => setShowFilters((prev) => !prev)}>
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Cold Call
          </Button>
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => void exportAll()}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export All to Excel
          </Button>
          {canAssign && (
            <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={() => (selected.length ? setAssignOpen(true) : toast.error('Select at least one cold call to assign'))}>
              <UserPlus className="mr-2 h-4 w-4" />
              Assign{selected.length ? ` (${selected.length})` : ''}
            </Button>
          )}
        </div>
      </div>

      <StatusTabs statuses={statuses} selected={statusTab} onSelect={changed(setStatusTab)} count={statusCount} />

      {showFilters && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
            <PersonFilter label="Assigned to" value={filterAssignee} onChange={changed(setFilterAssignee)} all="All Assignees" people={users} />
            <PersonFilter label="Team leader" value={filterTeamLeader} onChange={changed(setFilterTeamLeader)} all="All Team Leaders" people={teamLeaders} />
            {anyFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" /> Clear all filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Potential filter">
        <Button size="sm" aria-pressed={potential === 'all'} variant={potential === 'all' ? 'default' : 'outline'} onClick={() => changed(setPotential)('all')}>All</Button>
        <Button size="sm" aria-pressed={potential === 'potential'} variant={potential === 'potential' ? 'default' : 'outline'} className={potential === 'potential' ? 'bg-green-600' : ''} onClick={() => changed(setPotential)('potential')}>
          <Target className="mr-2 h-4 w-4" />
          Potentials
        </Button>
        <Button size="sm" aria-pressed={potential === 'non-potential'} variant={potential === 'non-potential' ? 'default' : 'outline'} className={potential === 'non-potential' ? 'bg-gray-600' : ''} onClick={() => changed(setPotential)('non-potential')}>
          <XCircle className="mr-2 h-4 w-4" />
          Non Potentials
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Show</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[80px]" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-500">entries</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <ExportButtons rows={exportRows} scopeLabel={selected.length ? 'selected cold call(s)' : 'cold call(s)'} title="Cold Calls" baseName="cold-calls" />
              <Button variant="outline" size="sm" onClick={() => setShowColumns(true)}>
                <Columns className="mr-2 h-4 w-4" />
                Columns
              </Button>
              {selected.length > 0 && (
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected ({selected.length})
                </Button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input aria-label="Search cold calls" placeholder="Search name or phone..." value={search} onChange={(e) => changed(setSearch)(e.target.value)} className="w-[250px] pl-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox aria-label="Select all cold calls on this page" checked={allOnPageSelected} onCheckedChange={togglePage} />
                  </TableHead>
                  {COLUMNS.filter((c) => columns[c.key]).map((c) => <TableHead key={c.key}>{c.key === 'id' ? '#' : c.label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={visibleColumnCount} className="py-10 text-center text-gray-500">
                      {isLoading && !coldCalls.length ? 'Loading cold calls...' : coldCalls.length ? 'No cold calls match the current filters.' : 'No cold calls yet.'}
                      {anyFilter && coldCalls.length > 0 && (
                        <div>
                          <Button variant="link" onClick={clearFilters}>Clear filters</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
                {pageRows.map((call) => (
                  <TableRow key={call.id} data-state={selected.includes(call.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox aria-label={`Select ${call.name}`} checked={selected.includes(call.id)} onCheckedChange={() => toggle(call.id)} />
                    </TableCell>
                    {columns.id && <TableCell className="font-medium">{call.id}</TableCell>}
                    {columns.type && <TableCell><Badge variant="outline">{call.type}</Badge></TableCell>}
                    {columns.name && <TableCell>{call.name}</TableCell>}
                    {columns.phone && <TableCell dir="ltr">{call.phone}</TableCell>}
                    {columns.status && (
                      <TableCell>
                        <Badge style={{ backgroundColor: statusColor(call.status), color: 'white' }}>{call.status || '-'}</Badge>
                      </TableCell>
                    )}
                    {columns.assignedTo && <TableCell>{call.assignedTo || '-'}</TableCell>}
                    {columns.teamLeader && <TableCell>{call.teamLeader || '-'}</TableCell>}
                    {columns.potential && (
                      <TableCell>
                        {call.isPotential ? (
                          <Badge className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" />Yes</Badge>
                        ) : (
                          <Badge variant="secondary"><XCircle className="mr-1 h-3 w-3" />No</Badge>
                        )}
                      </TableCell>
                    )}
                    {columns.date && <TableCell className="whitespace-nowrap">{call.date || '-'}</TableCell>}
                    {columns.notes && <TableCell className="max-w-[240px] truncate" title={call.notes}>{call.notes || '-'}</TableCell>}
                    {columns.action && (
                      <TableCell>
                        <div className="flex gap-1">
                          <ContactButtons phone={call.phone} name={call.name} onCall={() => callColdCall(call)} />
                          <Button variant="outline" size="icon" className="h-8 w-8" aria-label={`Log call with ${call.name}`} title="Log a call (Call Action)" onClick={() => callColdCall(call)}>
                            <PhoneCall className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8" aria-label={`Edit ${call.name}`} title="Edit cold call" onClick={() => openEdit(call)}>
                            <Edit className="h-4 w-4 text-gray-600" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8" aria-label={`History of ${call.name}`} title="Calls and comments" onClick={() => setCommentsCall(call)}>
                            <FileText className="h-4 w-4 text-gray-600" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination page={safePage} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={(open) => !saving && setFormOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Cold Call #${editing.id}` : 'Add New Cold Call'}</DialogTitle>
            <DialogDescription>Fields marked * are required. {CLIENT_PHONE_HINT}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveCall();
            }}
          >
            <Field id="call-name" label="Name *" error={formErrors.name}>
              <Input id="call-name" value={form.name} aria-invalid={Boolean(formErrors.name)} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </Field>
            <Field id="call-phone" label="Phone *" error={formErrors.phone}>
              <Input id="call-phone" type="tel" dir="ltr" placeholder="01012345678" value={form.phone} aria-invalid={Boolean(formErrors.phone)} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </Field>
            <Field id="call-status" label="Status *" error={formErrors.statusId}>
              <Select value={form.statusId} onValueChange={(v) => setForm((p) => ({ ...p, statusId: v }))}>
                <SelectTrigger id="call-status" aria-label="Status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="call-notes" label="Notes">
              <Textarea id="call-notes" rows={2} maxLength={5000} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </Field>
            <Field id="call-comment" label={`Comment${statusChanged ? ' *' : ''}`} error={formErrors.comment}>
              <Textarea
                id="call-comment"
                rows={3}
                maxLength={5000}
                value={form.comment}
                aria-invalid={Boolean(formErrors.comment)}
                placeholder={statusChanged ? 'Required: why did the status change?' : 'Optional - saved to the history and Reports'}
                onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Save Cold Call'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} count={selected.length} noun="cold call(s)" users={assignableUsers} busy={assigning} onAssign={assignSelected} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selected.length} cold call(s)?`}
        description="The selected cold calls are removed permanently. This cannot be undone."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={deleteSelected}
      />
      <Dialog open={Boolean(commentsCall)} onOpenChange={(open) => !open && setCommentsCall(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>History - {commentsCall?.name}</DialogTitle>
            <DialogDescription>Calls (with Delivery, Finishing and Purpose), comments and follow-ups of this cold call.</DialogDescription>
          </DialogHeader>
          {commentsCall && (
            <>
              <Button className="w-fit" onClick={() => callColdCall(commentsCall)}>
                <PhoneCall className="mr-2 h-4 w-4" /> Log a call
              </Button>
              <ActivityTimeline entityType="cold_call" entityId={commentsCall.id} refreshKey={historyRefresh} />
            </>
          )}
        </DialogContent>
      </Dialog>
      <ColumnsDialog open={showColumns} onOpenChange={setShowColumns} columns={COLUMNS} visible={columns} onChange={setColumns} />
      <CallActionDialog target={callTarget} onOpenChange={(open) => !open && setCallTarget(null)} onSaved={() => setHistoryRefresh((n) => n + 1)} />
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

function PersonFilter({ label, value, onChange, all, people }: { label: string; value: string; onChange: (v: string) => void; all: string; people: { id: number; name: string }[] }) {
  return (
    <div className="w-full space-y-1 sm:w-[220px]">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={`Filter by ${label.toLowerCase()}`}>
          <SelectValue placeholder={all} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{all}</SelectItem>
          {people.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
