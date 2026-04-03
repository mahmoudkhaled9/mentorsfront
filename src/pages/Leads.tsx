import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getVisibleUserIds } from '@/lib/hierarchy';
import { 
  Plus, 
  Search, 
  Filter, 
  Phone, 
  MessageCircle,
  UserPlus,
  FileText,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  File as FileIcon,
  Trash2,
  Columns,
  Edit
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { jsonRequest } from '@/lib/mutations';

export default function Leads() {
  const { user } = useAuth();
  const { leads, setLeads, statuses, users, comments, setComments, projects } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [showEntries, setShowEntries] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadStatus, setNewLeadStatus] = useState('');
  const [newLeadProjectId, setNewLeadProjectId] = useState('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterProject, setFilterProject] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [showColumnsDialog, setShowColumnsDialog] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    name: true,
    action: true,
    status: true,
    project: true,
    assignedTo: true,
    comments: true,
  });
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editLeadId, setEditLeadId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editProjectId, setEditProjectId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const canDateFilter = user?.role === 'admin' || user?.role === 'franchise_owner';
  const canAssign = ['admin', 'franchise_owner', 'director', 'sales_manager', 'sales_supervisor', 'team_leader'].includes(user?.role ?? '');
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [reassignLeadId, setReassignLeadId] = useState<number | null>(null);
  const [reassignUserId, setReassignUserId] = useState('');
  const [showBulkReassignDialog, setShowBulkReassignDialog] = useState(false);
  const [bulkReassignUserId, setBulkReassignUserId] = useState('');
  const canReassign = user?.role === 'admin' || user?.role === 'franchise_owner';

  const visibleUserIds = getVisibleUserIds(user, users);
  const scopedLeads = leads.filter(lead => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'franchise_owner') return true;
    const assignedVisible = lead.assignedToId && visibleUserIds.includes(lead.assignedToId);
    const teamLeaderVisible = lead.teamLeaderId && visibleUserIds.includes(lead.teamLeaderId);
    return assignedVisible || teamLeaderVisible;
  });

  // Get status counts
  const getStatusCount = (statusName: string) => {
    if (statusName === 'All') return scopedLeads.length;
    return scopedLeads.filter(lead => lead.status === statusName).length;
  };

  // Filter leads
  const filteredLeads = scopedLeads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm);
    
    const matchesStatus = selectedStatus === 'All' || lead.status === selectedStatus;

    const matchesProject =
      filterProject === 'all' ||
      (lead.project && lead.project === filterProject);

    const matchesAssignee =
      filterAssignee === 'all' ||
      (lead.assignedToId && lead.assignedToId.toString() === filterAssignee);
    
    const leadDate = lead.date || '';
    const matchesDate =
      (!filterDateFrom || (leadDate && leadDate >= filterDateFrom)) &&
      (!filterDateTo || (leadDate && leadDate <= filterDateTo));

    return matchesSearch && matchesStatus && matchesProject && matchesAssignee && matchesDate;
  });

  // Pagination
  const totalPages = Math.ceil(filteredLeads.length / showEntries);
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * showEntries,
    currentPage * showEntries
  );

  const toggleLeadSelection = (leadId: number) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const toggleAllSelection = () => {
    if (selectedLeads.length === paginatedLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(paginatedLeads.map(lead => lead.id));
    }
  };

  const getStatusColor = (statusName: string) => {
    const status = statuses.find(s => s.name === statusName);
    return status?.color || '#6B7280';
  };

  const sanitizePhone = (phone: string) => phone.replace(/[^\d+]/g, '');
  const normalizeWhatsAppPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('20')) return digits;
    if (digits.startsWith('0')) return `20${digits.slice(1)}`;
    return digits;
  };
  const getCallHref = (phone: string) => {
    const cleanPhone = sanitizePhone(phone);
    return cleanPhone ? `tel:${cleanPhone}` : '';
  };
  const getWhatsAppHref = (phone: string) => {
    const cleanPhone = normalizeWhatsAppPhone(phone);
    return cleanPhone ? `https://wa.me/${cleanPhone}` : '';
  };

  const handleReassign = async () => {
    if (!reassignLeadId || !reassignUserId) {
      toast.error('Select a user to reassign');
      return;
    }
    const assignee = users.find(u => u.id.toString() === reassignUserId);
    if (!assignee) {
      toast.error('Selected user not found');
      return;
    }
    const teamLeader = assignee.teamLeaderId
      ? users.find(u => u.id === assignee.teamLeaderId)
      : undefined;
    try {
      await jsonRequest(`leads/${reassignLeadId}`, {
        method: 'PUT',
        body: { assignedToId: assignee.id, teamLeaderId: teamLeader?.id },
      });
      setLeads(prev =>
        prev.map(lead =>
          lead.id === reassignLeadId
            ? {
                ...lead,
                assignedTo: assignee.name,
                assignedToId: assignee.id,
                teamLeaderId: teamLeader?.id,
                teamLeader: teamLeader?.name,
              }
            : lead
        )
      );
      toast.success('Lead reassigned');
      setShowReassignDialog(false);
      setReassignLeadId(null);
      setReassignUserId('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleBulkReassign = async () => {
    if (selectedLeads.length === 0) {
      toast.error('Select at least one lead to reassign');
      return;
    }
    if (!bulkReassignUserId) {
      toast.error('Select a user to reassign');
      return;
    }
    const assignee = users.find(u => u.id.toString() === bulkReassignUserId);
    if (!assignee) {
      toast.error('Selected user not found');
      return;
    }
    const teamLeader = assignee.teamLeaderId
      ? users.find(u => u.id === assignee.teamLeaderId)
      : undefined;
    try {
      await Promise.all(
        selectedLeads.map((leadId) =>
          jsonRequest(`leads/${leadId}`, {
            method: 'PUT',
            body: { assignedToId: assignee.id, teamLeaderId: teamLeader?.id },
          })
        )
      );
      setLeads(prev =>
        prev.map(lead =>
          selectedLeads.includes(lead.id)
            ? {
                ...lead,
                assignedTo: assignee.name,
                assignedToId: assignee.id,
                teamLeaderId: teamLeader?.id,
                teamLeader: teamLeader?.name,
              }
            : lead
        )
      );
      toast.success(`Reassigned ${selectedLeads.length} leads`);
      setSelectedLeads([]);
      setShowBulkReassignDialog(false);
      setBulkReassignUserId('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleAddLead = async () => {
    if (!newLeadName.trim() || !newLeadPhone.trim() || !newLeadStatus) {
      toast.error('Please fill in name, phone, and status');
      return;
    }

    const statusObj = statuses.find(s => s.name === newLeadStatus);
    const isPotential =
      newLeadStatus.toLowerCase().includes('potential') &&
      !newLeadStatus.toLowerCase().includes('non');
    const project = projects.find(p => p.id.toString() === newLeadProjectId);

    try {
      const created = await jsonRequest<{ ok: boolean; id?: number }>('leads', {
        method: 'POST',
        body: {
          name: newLeadName.trim(),
          phone: newLeadPhone.trim(),
          statusId: statusObj?.id ?? 0,
          projectId: project?.id,
          assignedToId: null,
          teamLeaderId: null,
          date: new Date().toISOString().split('T')[0],
        },
      });
      const nextId = created.id ?? (leads.length > 0 ? Math.max(...leads.map(l => l.id)) + 1 : 1);
      setLeads(prev => [
        ...prev,
        {
          id: nextId,
          type: 'Lead',
          name: newLeadName.trim(),
          phone: newLeadPhone.trim(),
          status: newLeadStatus,
          statusId: statusObj?.id ?? 0,
          project: project?.name,
          projectId: project?.id,
          date: new Date().toISOString().split('T')[0],
          isPotential,
        },
      ]);

      toast.success('Lead added successfully!');
      setShowAddDialog(false);
      setNewLeadName('');
      setNewLeadPhone('');
      setNewLeadStatus('');
      setNewLeadProjectId('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLeads.length === 0) {
      return;
    }
    try {
      await Promise.all(selectedLeads.map((leadId) => jsonRequest(`leads/${leadId}`, { method: 'DELETE' })));
      setLeads(prev => prev.filter(lead => !selectedLeads.includes(lead.id)));
      toast.success(`Deleted ${selectedLeads.length} leads`);
      setSelectedLeads([]);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleAssignSelected = async () => {
    if (!assignUserId) {
      toast.error('Please select a user to assign');
      return;
    }
    const assignee = users.find(u => u.id.toString() === assignUserId);
    if (!assignee) {
      toast.error('Selected user not found');
      return;
    }

    try {
      await Promise.all(
        selectedLeads.map((leadId) =>
          jsonRequest(`leads/${leadId}`, {
            method: 'PUT',
            body: { assignedToId: assignee.id },
          })
        )
      );
      setLeads(prev =>
        prev.map(lead =>
          selectedLeads.includes(lead.id)
            ? { ...lead, assignedTo: assignee.name, assignedToId: assignee.id }
            : lead
        )
      );
      toast.success(`Assigned ${selectedLeads.length} leads to ${assignee.name}`);
      setSelectedLeads([]);
      setAssignUserId('');
      setShowAssignDialog(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const openComments = (leadId: number) => {
    setActiveLeadId(leadId);
    setShowCommentDialog(true);
  };

  const handleAddComment = async () => {
    if (!activeLeadId || !newComment.trim()) {
      return;
    }
    const createdBy = user?.name || 'Unknown';
    const createdById = user?.id || 0;

    try {
      const created = await jsonRequest<{ ok: boolean; id?: number }>('comments', {
        method: 'POST',
        body: {
          leadId: activeLeadId,
          entityType: 'lead',
          entityId: activeLeadId,
          content: newComment.trim(),
          createdBy,
          createdById,
        },
      });
      const nextId = created.id ?? (comments.length > 0 ? Math.max(...comments.map(c => c.id)) + 1 : 1);
      setComments(prev => [
        ...prev,
        {
          id: nextId,
          leadId: activeLeadId,
          entityType: 'lead',
          entityId: activeLeadId,
          content: newComment.trim(),
          createdBy,
          createdById,
          createdAt: new Date().toLocaleString(),
        },
      ]);
      setNewComment('');
      toast.success('Comment added to reports');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const leadComments = activeLeadId
    ? comments.filter(comment => comment.leadId === activeLeadId)
    : [];

  const openEditDialog = (leadId: number, currentStatus: string) => {
    const lead = leads.find(l => l.id === leadId);
    setEditLeadId(leadId);
    setEditStatus(currentStatus);
    setEditComment('');
    setEditProjectId(lead?.projectId ? lead.projectId.toString() : '');
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editLeadId) return;
    if (!editComment.trim()) {
      toast.error('Comment is required');
      return;
    }

    const lead = leads.find(l => l.id === editLeadId);
    const statusObj = statuses.find(s => s.name === editStatus);
    const project = projects.find(p => p.id.toString() === editProjectId);
    const isPotential =
      editStatus.toLowerCase().includes('potential') &&
      !editStatus.toLowerCase().includes('non');

    try {
      await jsonRequest(`leads/${editLeadId}`, {
        method: 'PUT',
        body: {
          statusId: statusObj?.id ?? lead?.statusId,
          projectId: project?.id ?? lead?.projectId,
        },
      });

      const createdBy = user?.name || 'Unknown';
      const createdById = user?.id || 0;
      const created = await jsonRequest<{ ok: boolean; id?: number }>('comments', {
        method: 'POST',
        body: {
          leadId: editLeadId,
          entityType: 'lead',
          entityId: editLeadId,
          content: editComment.trim(),
          createdBy,
          createdById,
        },
      });

      setLeads(prev =>
        prev.map(lead =>
          lead.id === editLeadId
            ? {
                ...lead,
                status: editStatus,
                statusId: statusObj?.id ?? lead.statusId,
                isPotential,
                project: project?.name ?? lead.project,
                projectId: project?.id ?? lead.projectId,
              }
            : lead
        )
      );

      const nextId = created.id ?? (comments.length > 0 ? Math.max(...comments.map(c => c.id)) + 1 : 1);
      setComments(prev => [
        ...prev,
        {
          id: nextId,
          leadId: editLeadId,
          entityType: 'lead',
          entityId: editLeadId,
          content: editComment.trim(),
          createdBy,
          createdById,
          createdAt: new Date().toLocaleString(),
        },
      ]);

      toast.success('Lead updated and comment added');
      setShowEditDialog(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleProjectAssign = async (leadId: number, projectId: string) => {
    const project = projects.find(p => p.id.toString() === projectId);
    if (!project) return;
    try {
      await jsonRequest(`leads/${leadId}`, {
        method: 'PUT',
        body: { projectId: project.id },
      });
      setLeads(prev =>
        prev.map(lead =>
          lead.id === leadId
            ? { ...lead, project: project.name, projectId: project.id }
            : lead
        )
      );
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const exportSelectedToExcel = () => {
    if (selectedLeads.length === 0) {
      toast.error('Select at least one lead to export');
      return;
    }
    const selected = leads.filter(lead => selectedLeads.includes(lead.id));
    const rows = selected.map(lead => ({
      ID: lead.id,
      Name: lead.name,
      Phone: lead.phone,
      Status: lead.status,
      Project: lead.project || '',
      AssignedTo: lead.assignedTo || '',
      Date: lead.date || '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SelectedLeads');
    XLSX.writeFile(workbook, `selected-leads-${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success('Exported selected leads to Excel');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">My Leads</h1>
          <Badge variant="secondary" className="text-lg">
            {filteredLeads.length}
          </Badge>
        </div>
        <div className="flex gap-2">
          {canAssign && (
            <Button
              variant="outline"
              onClick={() => {
                if (selectedLeads.length === 0) {
                  toast.error('Select at least one lead to assign');
                  return;
                }
                setShowAssignDialog(true);
              }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Assign
            </Button>
          )}
          {canReassign && (
            <Button
              variant="outline"
              onClick={() => {
                if (selectedLeads.length === 0) {
                  toast.error('Select at least one lead to reassign');
                  return;
                }
                setShowBulkReassignDialog(true);
              }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Reassign
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowFilters((prev) => !prev)}>
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input placeholder="Name" value={newLeadName} onChange={(e) => setNewLeadName(e.target.value)} />
                <Input placeholder="Phone" value={newLeadPhone} onChange={(e) => setNewLeadPhone(e.target.value)} />
                <Select value={newLeadStatus} onValueChange={setNewLeadStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map(status => (
                      <SelectItem key={status.id} value={status.name}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newLeadProjectId} onValueChange={setNewLeadProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Project (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddLead}>
                  Save Lead
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={selectedStatus === 'All' ? 'default' : 'outline'}
          onClick={() => setSelectedStatus('All')}
          className="whitespace-nowrap"
        >
          All
          <Badge variant="secondary" className="ml-2">
            {getStatusCount('All')}
          </Badge>
        </Button>
        {statuses.map(status => (
          <Button
            key={status.id}
            variant={selectedStatus === status.name ? 'default' : 'outline'}
            onClick={() => setSelectedStatus(status.name)}
            className="whitespace-nowrap"
            style={selectedStatus === status.name ? {} : { borderColor: status.color }}
          >
            {status.name}
            <Badge 
              variant="secondary" 
              className="ml-2"
              style={{ backgroundColor: status.color + '20', color: status.color }}
            >
              {getStatusCount(status.name)}
            </Badge>
          </Button>
        ))}
      </div>

      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Filter by Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.name}>
                      {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
              </Select>

              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Filter by Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canDateFilter && (
              <div className="mt-4 flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-[220px]">
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    placeholder="From"
                  />
                </div>
                <div className="w-full sm:w-[220px]">
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    placeholder="To"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Show</span>
              <Select value={showEntries.toString()} onValueChange={(v) => setShowEntries(Number(v))}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-500">entries</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.success('Copied to clipboard!')}>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={exportSelectedToExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.success('Exported to PDF!')}>
                <FileIcon className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowColumnsDialog(true)}>
                <Columns className="w-4 h-4 mr-2" />
                Columns
              </Button>
              {selectedLeads.length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleDeleteSelected}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                </Button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-[250px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0}
                      onCheckedChange={toggleAllSelection}
                    />
                  </TableHead>
                  {visibleColumns.id && <TableHead>#</TableHead>}
                  {visibleColumns.name && <TableHead>Name</TableHead>}
                  {visibleColumns.action && <TableHead>Action</TableHead>}
                  {visibleColumns.status && <TableHead>Status</TableHead>}
                  {visibleColumns.project && <TableHead>Project</TableHead>}
                  {visibleColumns.assignedTo && <TableHead>Assign To</TableHead>}
                  {visibleColumns.comments && <TableHead>Comments</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedLeads.includes(lead.id)}
                        onCheckedChange={() => toggleLeadSelection(lead.id)}
                      />
                    </TableCell>
                    {visibleColumns.id && <TableCell className="font-medium">{lead.id}</TableCell>}
                    {visibleColumns.name && <TableCell>{lead.name}</TableCell>}
                    {visibleColumns.action && (
                      <TableCell>
                        <div className="flex gap-1">
                          {getCallHref(lead.phone) ? (
                            <Button asChild variant="outline" size="icon" className="h-8 w-8">
                              <a href={getCallHref(lead.phone)}>
                                <Phone className="w-4 h-4 text-green-600" />
                              </a>
                            </Button>
                          ) : (
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                              <Phone className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          {getWhatsAppHref(lead.phone) ? (
                            <Button asChild variant="default" size="icon" className="h-8 w-8 bg-green-500 hover:bg-green-600">
                              <a href={getWhatsAppHref(lead.phone)} target="_blank" rel="noreferrer">
                                <MessageCircle className="w-4 h-4" />
                              </a>
                            </Button>
                          ) : (
                            <Button variant="default" size="icon" className="h-8 w-8 bg-green-500 hover:bg-green-600" disabled>
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          )}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(lead.id, lead.status)}
                        >
                          <Edit className="w-4 h-4 text-gray-600" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                    {visibleColumns.status && (
                      <TableCell>
                        <Badge 
                          style={{ 
                            backgroundColor: getStatusColor(lead.status),
                            color: 'white'
                          }}
                        >
                          {lead.status}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleColumns.project && (
                      <TableCell>
                        <Select
                          value={lead.projectId ? lead.projectId.toString() : ''}
                          onValueChange={(value) => handleProjectAssign(lead.id, value)}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Select Project" />
                          </SelectTrigger>
                          <SelectContent>
                            {projects.map(project => (
                              <SelectItem key={project.id} value={project.id.toString()}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    {visibleColumns.assignedTo && <TableCell>{lead.assignedTo || '-'}</TableCell>}
                    {visibleColumns.comments && (
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openComments(lead.id)}>
                          <FileText className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-gray-500">
              Showing {(currentPage - 1) * showEntries + 1} to{' '}
              {Math.min(currentPage * showEntries, filteredLeads.length)} of{' '}
              {filteredLeads.length} entries
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Prev
              </Button>
              <Button variant="default" size="sm" className="min-w-[40px]">
                {currentPage}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Selected Leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={assignUserId} onValueChange={setAssignUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select User" />
              </SelectTrigger>
              <SelectContent>
                {users.filter(u => u.role !== 'admin').map(u => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssignSelected} disabled={!assignUserId}>
              Assign
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkReassignDialog} onOpenChange={setShowBulkReassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Selected Leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={bulkReassignUserId} onValueChange={setBulkReassignUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select User" />
              </SelectTrigger>
              <SelectContent>
                {users.filter(u => u.role !== 'admin' && u.role !== 'franchise_owner').map(u => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleBulkReassign} disabled={!bulkReassignUserId}>
              Reassign
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={reassignUserId} onValueChange={setReassignUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select User" />
              </SelectTrigger>
              <SelectContent>
                {users.filter(u => u.role !== 'admin' && u.role !== 'franchise_owner').map(u => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleReassign} disabled={!reassignUserId}>
              Reassign
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lead Comments</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {leadComments.length === 0 && (
              <p className="text-sm text-gray-500">No comments yet.</p>
            )}
            {leadComments.map(comment => (
              <div key={comment.id} className="p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-800">{comment.content}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {comment.createdBy} • {comment.createdAt}
                </p>
              </div>
            ))}
            <Input
              placeholder="Add a comment"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <Button onClick={handleAddComment} disabled={!activeLeadId}>
              Add Comment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map(status => (
                  <SelectItem key={status.id} value={status.name}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={editProjectId} onValueChange={setEditProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Project (optional)" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <textarea
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              rows={4}
              placeholder="Comment (required)"
              value={editComment}
              onChange={(e) => setEditComment(e.target.value)}
            />
            <Button onClick={handleSaveEdit} disabled={!editLeadId}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showColumnsDialog} onOpenChange={setShowColumnsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Visible Columns</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {Object.entries(visibleColumns).map(([key, value]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={value}
                  onCheckedChange={(checked) =>
                    setVisibleColumns(prev => ({
                      ...prev,
                      [key]: Boolean(checked),
                    }))
                  }
                />
                <span className="capitalize">{key}</span>
              </label>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
