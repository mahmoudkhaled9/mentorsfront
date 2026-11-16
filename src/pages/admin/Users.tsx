import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/hooks/useAuth';
import { usePersistentState } from '@/hooks/usePersistentState';
import { ApiError, errorMessage } from '@/lib/api';
import { jsonRequest } from '@/lib/mutations';
import { savedItem } from '@/lib/saved';
import { checkPhone, EGYPT_PHONE_HINT } from '@/lib/phone';
import { ROLE_OPTIONS, roleLabel } from '@/lib/roles';
import { passwordProblem } from '@/lib/passwords';
import type { ExportRow } from '@/lib/exporters';
import type { User, UserRole } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColumnsDialog } from '@/components/records/ColumnsDialog';
import { ConfirmDialog } from '@/components/records/ConfirmDialog';
import { ExportButtons } from '@/components/records/ExportButtons';
import { TablePagination } from '@/components/records/TablePagination';
import { pageCount } from '@/lib/table';
import { Plus, Search, Columns, Trash2, Edit, Mail, Phone, Briefcase, BarChart3 } from 'lucide-react';

type ColumnKey = 'id' | 'image' | 'name' | 'email' | 'phone' | 'department' | 'role' | 'title' | 'reportsTo' | 'status' | 'action';
const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'image', label: 'Image' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'department', label: 'Department' },
  { key: 'role', label: 'Role' },
  { key: 'title', label: 'Title' },
  { key: 'reportsTo', label: 'Reports To' },
  { key: 'status', label: 'Status' },
  { key: 'action', label: 'Actions' },
];
const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  id: true, image: true, name: true, email: true, phone: true, department: true, role: true, title: true, reportsTo: false, status: true, action: true,
};

/** Who can be someone's manager: anybody in a more senior role. The server also blocks reporting loops. */
const RANK: Record<string, number> = { franchise_owner: 100, ceo: 95, admin: 90, head_of_sales: 85, director: 80, sales_manager: 70, sales_supervisor: 60, team_leader: 50, agent: 10 };
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-500', franchise_owner: 'bg-indigo-600', ceo: 'bg-slate-700', head_of_sales: 'bg-fuchsia-600', director: 'bg-rose-500', sales_manager: 'bg-amber-500',
  sales_supervisor: 'bg-teal-500', team_leader: 'bg-blue-500', agent: 'bg-green-500',
};
const PAGE_SIZES = [10, 25, 50, 100];
const NONE = '__none__';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface UserForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole | '';
  title: string;
  parentId: string;
  isActive: boolean;
}

const emptyForm = (): UserForm => ({ name: '', email: '', phone: '', password: '', role: '', title: '', parentId: '', isActive: true });

export default function AdminUsers() {
  const { users, setUsers, titles, leads, coldCalls, deals, reload } = useData();
  const { user: currentUser, isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [pageSize, setPageSize] = usePersistentState('mentors.users.pageSize', 10);
  const [page, setPage] = useState(1);
  const [columns, setColumns] = usePersistentState<Record<ColumnKey, boolean>>('mentors.users.columns', DEFAULT_COLUMNS);
  const [showColumns, setShowColumns] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<User[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [performanceUser, setPerformanceUser] = useState<User | null>(null);

  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => users.filter((u) =>
    !term ||
    u.name.toLowerCase().includes(term) ||
    u.email.toLowerCase().includes(term) ||
    (u.phone ?? '').includes(term) ||
    (u.department ?? '').toLowerCase().includes(term) ||
    roleLabel(u.role).toLowerCase().includes(term)
  ), [users, term]);
  const pages = pageCount(filtered.length, pageSize);
  const safePage = Math.min(page, pages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((u) => selected.includes(u.id));
  const nameOf = (id?: number) => users.find((u) => u.id === id)?.name ?? '';

  const parentOptions = (role: string, selfId?: number) =>
    users.filter((u) => u.id !== selfId && u.isActive !== false && (RANK[u.role] ?? 0) > (RANK[role] ?? 0));

  const exportRows = (): ExportRow[] =>
    (selected.length ? users.filter((u) => selected.includes(u.id)) : filtered).map((u) => ({
      ID: u.id, Name: u.name, Email: u.email, Phone: u.phone ?? '', Department: u.department ?? '', Role: roleLabel(u.role),
      Title: u.title ?? '', 'Reports To': nameOf(u.teamLeaderId), Status: u.isActive === false ? 'Inactive' : 'Active',
    }));

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setErrors({});
    setFormOpen(true);
  };
  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, phone: u.phone ?? '', password: '', role: u.role, title: u.title ?? '', parentId: u.teamLeaderId ? String(u.teamLeaderId) : '', isActive: u.isActive !== false });
    setErrors({});
    setFormOpen(true);
  };
  const set = <K extends keyof UserForm>(key: K, value: UserForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (saving) return;
    const problems: Record<string, string> = {};
    if (!form.name.trim()) problems.name = 'Name is required';
    if (!EMAIL.test(form.email.trim())) problems.email = 'Enter a valid email address';
    const phone = checkPhone(form.phone, { required: !editing, keep: editing?.phone, kind: 'employee' });
    if (!phone.ok) problems.phone = phone.message;
    if (!form.role) problems.role = 'Choose a role';
    if (!editing || form.password) {
      const pw = passwordProblem(form.password, { email: form.email.trim(), name: form.name.trim() });
      if (pw) problems.password = pw;
    }
    setErrors(problems);
    if (Object.keys(problems).length || !phone.ok) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: phone.value,
        role: form.role,
        title: form.title,
        teamLeaderId: form.parentId ? Number(form.parentId) : null,
        isActive: form.isActive,
      };
      if (form.password) body.password = form.password;
      if (!editing) body.department = 'Sales';
      const result = editing
        ? await jsonRequest<{ item: User }>(`users/${editing.id}`, { method: 'PUT', body })
        : await jsonRequest<{ item: User }>('users', { method: 'POST', body });
      const saved = savedItem<User>(result);
      if (saved) setUsers((prev) => (editing ? prev.map((u) => (u.id === saved.id ? saved : u)) : [...prev, saved]));
      else await reload(['users']);
      // Renaming / moving someone changes names shown on leads, cold calls and reports.
      if (editing) void reload(['leads', 'coldCalls', 'reports']);
      toast.success(editing ? 'User updated' : 'User added');
      setFormOpen(false);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setErrors((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k === 'teamLeaderId' ? 'parentId' : k, v])) }));
      }
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    const results = await Promise.allSettled(toDelete.map((u) => jsonRequest(`users/${u.id}`, { method: 'DELETE' })));
    const removed = toDelete.filter((_, i) => results[i].status === 'fulfilled').map((u) => u.id);
    const failures = results.flatMap((r, i) => (r.status === 'rejected' ? [`${toDelete[i].name}: ${errorMessage(r.reason)}`] : []));
    setUsers((prev) => prev.filter((u) => !removed.includes(u.id)));
    setSelected((prev) => prev.filter((id) => !removed.includes(id)));
    if (removed.length) {
      toast.success(`Deleted ${removed.length} user(s). Their leads and cold calls are now unassigned.`);
      void reload(['leads', 'coldCalls', 'deals']);
    }
    failures.forEach((f) => toast.error(f));
    setDeleting(false);
    setToDelete([]);
  };

  const stats = (userId: number) => {
    const userLeads = leads.filter((l) => l.assignedToId === userId);
    const userCalls = coldCalls.filter((c) => c.assignedToId === userId);
    return {
      leads: userLeads.length,
      coldCalls: userCalls.length,
      deals: deals.filter((d) => d.agentId === userId).length,
      meetings: [...userLeads, ...userCalls].filter((i) => i.status.toLowerCase().includes('meeting')).length,
    };
  };

  const toggle = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const togglePage = () =>
    setSelected((prev) => (allOnPageSelected ? prev.filter((id) => !pageRows.some((u) => u.id === id)) : [...new Set([...prev, ...pageRows.map((u) => u.id)])]));
  const isSelf = (u: User | null) => Boolean(u && currentUser && u.id === currentUser.id);
  const parentChoices = form.role ? parentOptions(form.role, editing?.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">User List</h1>
          <Badge variant="secondary" className="text-lg">{filtered.length}</Badge>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add user
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Show</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[80px]" aria-label="Rows per page"><SelectValue /></SelectTrigger>
                <SelectContent>{PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
              <span className="text-sm text-gray-500">entries</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <ExportButtons rows={exportRows} scopeLabel={selected.length ? 'selected user(s)' : 'user(s)'} title="Users" baseName="users" />
              <Button variant="outline" size="sm" onClick={() => setShowColumns(true)}>
                <Columns className="mr-2 h-4 w-4" />
                Columns
              </Button>
              {selected.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const list = users.filter((u) => selected.includes(u.id) && !isSelf(u));
                    if (!list.length) toast.error('You cannot delete your own account');
                    else setToDelete(list);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected ({selected.length})
                </Button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input aria-label="Search users" placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); setSelected([]); }} className="w-[250px] pl-10" />
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
                  <TableHead className="w-10"><Checkbox aria-label="Select all users on this page" checked={allOnPageSelected} onCheckedChange={togglePage} /></TableHead>
                  {COLUMNS.filter((c) => columns[c.key]).map((c) => <TableHead key={c.key}>{c.key === 'id' ? '#' : c.label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={1 + COLUMNS.filter((c) => columns[c.key]).length} className="py-10 text-center text-gray-500">
                      {users.length ? 'No users match the search.' : 'No users yet.'}
                    </TableCell>
                  </TableRow>
                )}
                {pageRows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell><Checkbox aria-label={`Select ${u.name}`} checked={selected.includes(u.id)} onCheckedChange={() => toggle(u.id)} /></TableCell>
                    {columns.id && <TableCell className="font-medium">{u.id}</TableCell>}
                    {columns.image && (
                      <TableCell>
                        <Avatar className="h-10 w-10">
                          {u.avatar ? <AvatarImage src={u.avatar} alt="" /> : null}
                          <AvatarFallback className="bg-gray-200 text-gray-600">{u.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                    )}
                    {columns.name && <TableCell className="font-medium">{u.name}{isSelf(u) && <span className="ml-1 text-xs text-gray-500">(you)</span>}</TableCell>}
                    {columns.email && <TableCell><span className="flex items-center gap-2"><Mail className="h-4 w-4 text-gray-400" />{u.email}</span></TableCell>}
                    {columns.phone && <TableCell><span className="flex items-center gap-2" dir="ltr"><Phone className="h-4 w-4 text-gray-400" />{u.phone || '-'}</span></TableCell>}
                    {columns.department && <TableCell><span className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-gray-400" />{u.department || '-'}</span></TableCell>}
                    {columns.role && <TableCell><Badge className={ROLE_COLORS[u.role] ?? ''}>{roleLabel(u.role)}</Badge></TableCell>}
                    {columns.title && <TableCell>{u.title || '-'}</TableCell>}
                    {columns.reportsTo && <TableCell>{nameOf(u.teamLeaderId) || '-'}</TableCell>}
                    {columns.status && <TableCell>{u.isActive === false ? <Badge variant="secondary">Inactive</Badge> : <Badge className="bg-green-600">Active</Badge>}</TableCell>}
                    {columns.action && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isAdmin && (
                            <Button variant="outline" size="sm" className="h-8" onClick={() => setPerformanceUser(u)}>
                              <BarChart3 className="mr-1 h-4 w-4" />
                              View Performance
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${u.name}`} title="Edit user" onClick={() => openEdit(u)}>
                            <Edit className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Delete ${u.name}`}
                            title={isSelf(u) ? 'You cannot delete your own account' : 'Delete user'}
                            disabled={isSelf(u)}
                            onClick={() => setToDelete([u])}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
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
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit User - ${editing.name}` : 'Add New User'}</DialogTitle>
            <DialogDescription>Fields marked * are required.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Field id="user-name" label="Full Name *" error={errors.name}>
              <Input id="user-name" value={form.name} autoComplete="off" aria-invalid={Boolean(errors.name)} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field id="user-email" label="Email *" error={errors.email}>
              <Input id="user-email" type="email" autoComplete="off" value={form.email} aria-invalid={Boolean(errors.email)} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field id="user-phone" label={editing ? 'Phone' : 'Phone *'} error={errors.phone} hint={EGYPT_PHONE_HINT}>
              <Input id="user-phone" type="tel" dir="ltr" placeholder="01012345678" value={form.phone} aria-invalid={Boolean(errors.phone)} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field id="user-password" label={editing ? 'New Password' : 'Password *'} error={errors.password} hint={editing ? 'Leave blank to keep the current password. At least 8 characters.' : 'At least 8 characters, not the same as the email or name.'}>
              <Input id="user-password" type="password" autoComplete="new-password" value={form.password} aria-invalid={Boolean(errors.password)} onChange={(e) => set('password', e.target.value)} />
            </Field>
            <Field id="user-role" label="Role *" error={errors.role}>
              <Select
                value={form.role}
                disabled={isSelf(editing)}
                onValueChange={(value) => setForm((prev) => ({ ...prev, role: value as UserRole, parentId: '' }))}
              >
                <SelectTrigger id="user-role" aria-label="Role"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field id="user-title" label="Title">
              <Select value={form.title || NONE} onValueChange={(v) => set('title', v === NONE ? '' : v)}>
                <SelectTrigger id="user-title" aria-label="Title"><SelectValue placeholder="Select title" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No title</SelectItem>
                  {titles.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {form.role && form.role !== 'admin' && form.role !== 'franchise_owner' && (
              <Field id="user-parent" label="Reports to" error={errors.parentId} hint="Their manager or team leader. This decides whose leads they can see.">
                <Select value={form.parentId || NONE} onValueChange={(v) => set('parentId', v === NONE ? '' : v)}>
                  <SelectTrigger id="user-parent" aria-label="Reports to"><SelectValue placeholder="Select manager" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nobody</SelectItem>
                    {parentChoices.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({roleLabel(p.role)})</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {editing && (
              <div className="flex items-center gap-3">
                <Switch id="user-active" checked={form.isActive} disabled={isSelf(editing)} onCheckedChange={(v) => set('isActive', v)} />
                <Label htmlFor="user-active">{form.isActive ? 'Active - can sign in' : 'Inactive - cannot sign in'}</Label>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Add User'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete.length > 0}
        onOpenChange={(open) => !open && setToDelete([])}
        title={toDelete.length === 1 ? `Delete ${toDelete[0].name}?` : `Delete ${toDelete.length} users?`}
        description="Deleted users can no longer sign in. Their leads, cold calls and deals stay but become unassigned. To keep the history, consider marking the user Inactive instead."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
      />

      <Dialog open={Boolean(performanceUser)} onOpenChange={(open) => !open && setPerformanceUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{performanceUser ? `Performance - ${performanceUser.name}` : 'Performance'}</DialogTitle>
            <DialogDescription>Records currently assigned to this person.</DialogDescription>
          </DialogHeader>
          {performanceUser && (() => {
            const s = stats(performanceUser.id);
            return (
              <div className="grid grid-cols-2 gap-3">
                {([['Meetings', s.meetings], ['Deals', s.deals], ['Cold Calls', s.coldCalls], ['Leads', s.leads]] as const).map(([label, value]) => (
                  <div key={label} className="rounded-lg border bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-xl font-semibold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <ColumnsDialog open={showColumns} onOpenChange={setShowColumns} columns={COLUMNS} visible={columns} onChange={setColumns} />
    </div>
  );
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-red-600" role="alert">{error}</p> : hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}
