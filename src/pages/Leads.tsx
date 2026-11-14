import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/hooks/useAuth';
import { usePersistentState } from '@/hooks/usePersistentState';
import { errorMessage } from '@/lib/api';
import { jsonRequest } from '@/lib/mutations';
import { savedItem } from '@/lib/saved';
import { isAssignerRole, isSuperRole } from '@/lib/roles';
import {
  budgetText,
  emptyRequirementFilters,
  formatMoney,
  hasRequirementFilters,
  matchesRequirementFilters,
  requirementsSummary,
  type RequirementFilters,
} from '@/lib/requirements';
import type { ExportRow } from '@/lib/exporters';
import type { Lead } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { AssignDialog } from '@/components/records/AssignDialog';
import { ColumnsDialog } from '@/components/records/ColumnsDialog';
import { CommentsDialog } from '@/components/records/CommentsDialog';
import { ConfirmDialog } from '@/components/records/ConfirmDialog';
import { ContactButtons } from '@/components/records/ContactButtons';
import { ExportButtons } from '@/components/records/ExportButtons';
import { StatusTabs } from '@/components/records/StatusTabs';
import { TablePagination } from '@/components/records/TablePagination';
import { pageCount } from '@/lib/table';
import { Plus, Search, Filter, UserPlus, FileText, Trash2, Columns, Edit, X, PhoneCall } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CallActionDialog, type CallTarget } from '@/components/calls/CallActionDialog';

type ColumnKey = 'id' | 'name' | 'phone' | 'action' | 'status' | 'source' | 'project' | 'requirements' | 'assignedTo' | 'teamLeader' | 'date' | 'comments';

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'action', label: 'Actions' },
  { key: 'status', label: 'Status' },
  { key: 'source', label: 'Source' },
  { key: 'project', label: 'Project' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'assignedTo', label: 'Assigned To' },
  { key: 'teamLeader', label: 'Team Leader' },
  { key: 'date', label: 'Date' },
  { key: 'comments', label: 'Comments' },
];

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  id: true, name: true, phone: false, action: true, status: true, source: false, project: true,
  requirements: true, assignedTo: true, teamLeader: false, date: false, comments: true,
};

const PAGE_SIZES = [10, 25, 50, 100];
const NONE = '__none__';


export default function Leads() {
  const { user } = useAuth();
  const { leads, setLeads, statuses, leadSources, users, projects, leadOptions, reload, isLoading } = useData();
  const canAssign = isAssignerRole(user?.role);
  const canDateFilter = isSuperRole(user?.role);

  // ---- view state ------------------------------------------------------------------------------------------------
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('All');
  const [selected, setSelected] = useState<number[]>([]);
  const [pageSize, setPageSize] = usePersistentState('mentors.leads.pageSize', 10);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filterProject, setFilterProject] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reqFilters, setReqFilters] = useState<RequirementFilters>(emptyRequirementFilters());
  const [columns, setColumns] = usePersistentState<Record<ColumnKey, boolean>>('mentors.leads.columns', DEFAULT_COLUMNS);
  const [showColumns, setShowColumns] = useState(false);

  // ---- dialogs -----------------------------------------------------------------------------------------------------
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [commentsLead, setCommentsLead] = useState<Lead | null>(null);
  const [callTarget, setCallTarget] = useState<CallTarget | null>(null);
  const callLead = (lead: Lead) => setCallTarget({ type: 'lead', id: lead.id, name: lead.name, phone: lead.phone, whatsapp: lead.whatsapp, statusId: lead.statusId });

  /** Any filter change starts again on page 1 with nothing selected (so actions never hit hidden rows). */
  const resetView = () => {
    setPage(1);
    setSelected([]);
  };
  const changed = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    resetView();
  };

  // ---- filtering ---------------------------------------------------------------------------------------------------
  const term = search.trim().toLowerCase();
  const termDigits = term.replace(/\D/g, '');
  const matchesAllButStatus = useMemo(() => (lead: Lead) => {
    if (term) {
      const text = `${lead.name} ${lead.email ?? ''} ${lead.project ?? ''} ${lead.assignedTo ?? ''}`.toLowerCase();
      const phones = `${lead.phone ?? ''} ${lead.whatsapp ?? ''}`.replace(/\D/g, '');
      if (!text.includes(term) && !(termDigits.length >= 3 && phones.includes(termDigits))) return false;
    }
    if (filterProject !== 'all' && String(lead.projectId ?? '') !== filterProject) return false;
    if (filterAssignee !== 'all' && String(lead.assignedToId ?? '') !== filterAssignee) return false;
    if (filterSource !== 'all' && String(lead.sourceId ?? '') !== filterSource) return false;
    const day = lead.date || '';
    if (dateFrom && (!day || day < dateFrom)) return false;
    if (dateTo && (!day || day > dateTo)) return false;
    return matchesRequirementFilters(lead.requirements, reqFilters);
  }, [term, termDigits, filterProject, filterAssignee, filterSource, dateFrom, dateTo, reqFilters]);

  const beforeStatus = useMemo(() => leads.filter(matchesAllButStatus), [leads, matchesAllButStatus]);
  const filtered = useMemo(
    () => (statusTab === 'All' ? beforeStatus : beforeStatus.filter((l) => l.status === statusTab)),
    [beforeStatus, statusTab]
  );
  const statusCount = (name: string) => (name === 'All' ? beforeStatus.length : beforeStatus.filter((l) => l.status === name).length);

  const pages = pageCount(filtered.length, pageSize);
  const safePage = Math.min(page, pages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((l) => selected.includes(l.id));

  const anyFilter = Boolean(term) || filterProject !== 'all' || filterAssignee !== 'all' || filterSource !== 'all' || Boolean(dateFrom) || Boolean(dateTo) || hasRequirementFilters(reqFilters) || statusTab !== 'All';
  const clearFilters = () => {
    setSearch('');
    setStatusTab('All');
    setFilterProject('all');
    setFilterAssignee('all');
    setFilterSource('all');
    setDateFrom('');
    setDateTo('');
    setReqFilters(emptyRequirementFilters());
    resetView();
  };

  const assignableUsers = users.filter((u) => u.isActive !== false && !isSuperRole(u.role));
  const statusColor = (name: string) => statuses.find((s) => s.name === name)?.color || '#6B7280';
  const optionLabel = (list: { value: string; label: string }[], value: string | null | undefined) => list.find((o) => o.value === value)?.label ?? '';

  // ---- export ------------------------------------------------------------------------------------------------------
  const exportRows = (): ExportRow[] => {
    const source = selected.length ? leads.filter((l) => selected.includes(l.id)) : filtered;
    const names = (ids: number[] | undefined, list: { id: number; name: string }[]) => (ids ?? []).map((id) => list.find((o) => o.id === id)?.name).filter(Boolean).join(', ');
    return source.map((l) => ({
      ID: l.id,
      Name: l.name,
      Phone: l.phone,
      WhatsApp: l.whatsapp ?? '',
      Email: l.email ?? '',
      Status: l.status,
      Source: l.source ?? '',
      Project: l.project ?? '',
      'Assigned To': l.assignedTo ?? '',
      'Team Leader': l.teamLeader ?? '',
      Date: l.date ?? '',
      Destinations: names(l.requirements?.destinationIds, leadOptions.destinations),
      'Property Types': names(l.requirements?.propertyTypeIds, leadOptions.propertyTypes),
      Budget: budgetText(l.requirements),
      Delivery: optionLabel(leadOptions.delivery, l.requirements?.delivery),
      Finishing: optionLabel(leadOptions.finishing, l.requirements?.finishing),
      'Down Payment': formatMoney(l.requirements?.downPayment),
      'Installment / Quarter': formatMoney(l.requirements?.installmentPerQuarter),
      Purpose: optionLabel(leadOptions.purpose, l.requirements?.purpose),
    }));
  };

  // ---- add / edit --------------------------------------------------------------------------------------------------
  const openAdd = () => {
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingId(lead.id);
    setFormOpen(true);
  };

  // ---- row actions ---------------------------------------------------------------------------------------------------
  const changeProject = async (lead: Lead, projectId: string) => {
    try {
      const result = await jsonRequest<{ item: Lead }>(`leads/${lead.id}`, { method: 'PUT', body: { projectId: projectId === NONE ? null : Number(projectId) } });
      const saved = savedItem<Lead>(result);
      if (saved) setLeads((prev) => prev.map((l) => (l.id === lead.id ? saved : l)));
      else await reload(['leads']);
      toast.success(`Project updated for ${lead.name}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const assignSelected = async (userId: number) => {
    setAssigning(true);
    try {
      const result = await jsonRequest<{ count: number }>('leads/bulk-assign', { method: 'POST', body: { ids: selected, assignedToId: userId } });
      await reload(['leads']);
      const person = users.find((u) => u.id === userId);
      toast.success(`Assigned ${result.count} lead(s) to ${person?.name ?? 'the selected user'}`);
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
      const result = await jsonRequest<{ count: number }>('leads/bulk-delete', { method: 'POST', body: { ids: selected } });
      setLeads((prev) => prev.filter((l) => !selected.includes(l.id)));
      toast.success(`Deleted ${result.count} lead(s)`);
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
    setSelected((prev) => (allOnPageSelected ? prev.filter((id) => !pageRows.some((l) => l.id === id)) : [...new Set([...prev, ...pageRows.map((l) => l.id)])]));

  const visibleColumnCount = 1 + COLUMNS.filter((c) => columns[c.key]).length;

  // ---- render --------------------------------------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">My Leads</h1>
          <Badge variant="secondary" className="text-lg" data-testid="leads-count">{filtered.length}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAssign && (
            <Button
              variant="outline"
              onClick={() => (selected.length ? setAssignOpen(true) : toast.error('Select at least one lead to assign'))}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Assign{selected.length ? ` (${selected.length})` : ''}
            </Button>
          )}
          <Button variant={showFilters ? 'default' : 'outline'} aria-expanded={showFilters} onClick={() => setShowFilters((prev) => !prev)}>
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </div>

      <StatusTabs statuses={statuses} selected={statusTab} onSelect={changed(setStatusTab)} count={statusCount} />

      {showFilters && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FilterSelect label="Project" value={filterProject} onChange={changed(setFilterProject)} all="All Projects" options={projects.map((p) => ({ value: String(p.id), label: p.name }))} />
              <FilterSelect label="Assigned to" value={filterAssignee} onChange={changed(setFilterAssignee)} all="All Assignees" options={users.map((u) => ({ value: String(u.id), label: u.name }))} />
              <FilterSelect label="Source" value={filterSource} onChange={changed(setFilterSource)} all="All Sources" options={leadSources.map((s) => ({ value: String(s.id), label: s.name }))} />
              {canDateFilter && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="leads-from">From</Label>
                    <Input id="leads-from" type="date" value={dateFrom} onChange={(e) => changed(setDateFrom)(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="leads-to">To</Label>
                    <Input id="leads-to" type="date" value={dateTo} onChange={(e) => changed(setDateTo)(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm font-medium text-gray-700">Client requirements</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <FilterSelect label="Destination" value={reqFilters.destinationId} onChange={(v) => changed(setReqFilters)({ ...reqFilters, destinationId: v })} all="Any destination" options={leadOptions.destinations.map((o) => ({ value: String(o.id), label: o.name }))} />
              <FilterSelect label="Property type" value={reqFilters.propertyTypeId} onChange={(v) => changed(setReqFilters)({ ...reqFilters, propertyTypeId: v })} all="Any type" options={leadOptions.propertyTypes.map((o) => ({ value: String(o.id), label: o.name }))} />
              <FilterSelect label="Purpose" value={reqFilters.purpose} onChange={(v) => changed(setReqFilters)({ ...reqFilters, purpose: v })} all="Any purpose" options={leadOptions.purpose} />
              <FilterSelect label="Delivery" value={reqFilters.delivery} onChange={(v) => changed(setReqFilters)({ ...reqFilters, delivery: v })} all="Any delivery" options={leadOptions.delivery} />
              <FilterSelect label="Finishing" value={reqFilters.finishing} onChange={(v) => changed(setReqFilters)({ ...reqFilters, finishing: v })} all="Any finishing" options={leadOptions.finishing} />
              <div className="space-y-1">
                <Label htmlFor="leads-budget">Budget fits (EGP)</Label>
                <Input id="leads-budget" inputMode="decimal" placeholder="e.g. 5,000,000" value={reqFilters.budget} onChange={(e) => changed(setReqFilters)({ ...reqFilters, budget: e.target.value })} />
              </div>
            </div>
            {anyFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" /> Clear all filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

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
              <ExportButtons rows={exportRows} scopeLabel={selected.length ? 'selected lead(s)' : 'lead(s)'} title="Leads" baseName="leads" />
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
              <Input
                aria-label="Search leads"
                placeholder="Search name, phone, email..."
                value={search}
                onChange={(e) => changed(setSearch)(e.target.value)}
                className="w-[260px] pl-10"
              />
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
                    <Checkbox aria-label="Select all leads on this page" checked={allOnPageSelected} onCheckedChange={togglePage} />
                  </TableHead>
                  {COLUMNS.filter((c) => columns[c.key]).map((c) => <TableHead key={c.key}>{c.key === 'id' ? '#' : c.label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={visibleColumnCount} className="py-10 text-center text-gray-500">
                      {isLoading && !leads.length ? 'Loading leads...' : leads.length ? 'No leads match the current filters.' : 'No leads yet. Use "Add Lead" to create the first one.'}
                      {anyFilter && leads.length > 0 && (
                        <div>
                          <Button variant="link" onClick={clearFilters}>Clear filters</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
                {pageRows.map((lead) => (
                  <TableRow key={lead.id} data-state={selected.includes(lead.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox aria-label={`Select ${lead.name}`} checked={selected.includes(lead.id)} onCheckedChange={() => toggle(lead.id)} />
                    </TableCell>
                    {columns.id && <TableCell className="font-medium">{lead.id}</TableCell>}
                    {columns.name && (
                      <TableCell>
                        <Link to={`/leads/${lead.id}`} className="font-medium text-gray-900 underline-offset-2 hover:underline" title="Open lead details">{lead.name}</Link>
                        {lead.email && <div className="text-xs text-gray-500">{lead.email}</div>}
                      </TableCell>
                    )}
                    {columns.phone && <TableCell dir="ltr">{lead.phone}</TableCell>}
                    {columns.action && (
                      <TableCell>
                        <div className="flex gap-1">
                          <ContactButtons phone={lead.phone} whatsapp={lead.whatsapp} name={lead.name} onCall={() => callLead(lead)} />
                          <Button variant="outline" size="icon" className="h-8 w-8" aria-label={`Log call with ${lead.name}`} title="Log a call (Call Action)" onClick={() => callLead(lead)}>
                            <PhoneCall className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8" aria-label={`Edit ${lead.name}`} title="Edit lead" onClick={() => openEdit(lead)}>
                            <Edit className="h-4 w-4 text-gray-600" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                    {columns.status && (
                      <TableCell>
                        <Badge style={{ backgroundColor: statusColor(lead.status), color: 'white' }}>{lead.status || '-'}</Badge>
                      </TableCell>
                    )}
                    {columns.source && <TableCell>{lead.source || '-'}</TableCell>}
                    {columns.project && (
                      <TableCell>
                        <Select value={lead.projectId ? String(lead.projectId) : NONE} onValueChange={(v) => void changeProject(lead, v)}>
                          <SelectTrigger className="w-[170px]" aria-label={`Project of ${lead.name}`}>
                            <SelectValue placeholder="Select Project" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>No project</SelectItem>
                            {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    {columns.requirements && (
                      <TableCell className="max-w-[260px]">
                        {(() => {
                          const text = requirementsSummary(lead.requirements, leadOptions);
                          return text ? <span className="line-clamp-2 text-xs text-gray-700" title={text}>{text}</span> : <span className="text-xs text-gray-400">Not specified</span>;
                        })()}
                      </TableCell>
                    )}
                    {columns.assignedTo && <TableCell>{lead.assignedTo || '-'}</TableCell>}
                    {columns.teamLeader && <TableCell>{lead.teamLeader || '-'}</TableCell>}
                    {columns.date && <TableCell className="whitespace-nowrap">{lead.date || '-'}</TableCell>}
                    {columns.comments && (
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setCommentsLead(lead)} aria-label={`Comments of ${lead.name}`}>
                          <FileText className="mr-2 h-4 w-4" />
                          View
                        </Button>
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

      {/* Add / edit lead */}
      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} leadId={editingId} />

      <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} count={selected.length} noun="lead(s)" users={assignableUsers} busy={assigning} onAssign={assignSelected} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selected.length} lead(s)?`}
        description="The selected leads and their requirements are removed permanently. This cannot be undone."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={deleteSelected}
      />

      <CommentsDialog
        open={Boolean(commentsLead)}
        onOpenChange={(open) => !open && setCommentsLead(null)}
        entityType="lead"
        entityId={commentsLead?.id ?? null}
        title={commentsLead ? `Comments - ${commentsLead.name}` : 'Comments'}
      />

      <ColumnsDialog open={showColumns} onOpenChange={setShowColumns} columns={COLUMNS} visible={columns} onChange={setColumns} />
      <CallActionDialog target={callTarget} onOpenChange={(open) => !open && setCallTarget(null)} />
    </div>
  );
}

function FilterSelect({ label, value, onChange, all, options }: { label: string; value: string; onChange: (v: string) => void; all: string; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={`Filter by ${label.toLowerCase()}`}>
          <SelectValue placeholder={all} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{all}</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
