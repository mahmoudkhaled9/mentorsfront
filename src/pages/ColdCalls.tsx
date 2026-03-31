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
  ChevronLeft,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  File as FileIcon,
  Columns,
  Trash2,
  Target,
  XCircle,
  CheckCircle,
  Edit
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { jsonRequest } from '@/lib/mutations';

export default function ColdCalls() {
  const { user } = useAuth();
  const { coldCalls, setColdCalls, statuses, users, comments, setComments } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [potentialFilter, setPotentialFilter] = useState<string>('all');
  const [selectedCalls, setSelectedCalls] = useState<number[]>([]);
  const [showEntries, setShowEntries] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterTeamLeader, setFilterTeamLeader] = useState('all');
  const [newCallName, setNewCallName] = useState('');
  const [newCallPhone, setNewCallPhone] = useState('');
  const [newCallStatus, setNewCallStatus] = useState('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignAgentId, setAssignAgentId] = useState('');
  const [assignTeamLeaderId, setAssignTeamLeaderId] = useState('');
  const [showColumnsDialog, setShowColumnsDialog] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    type: true,
    name: true,
    phone: true,
    status: true,
    assignedTo: true,
    teamLeader: true,
    potential: true,
    action: true,
  });
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editCallId, setEditCallId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editComment, setEditComment] = useState('');
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [reassignCallId, setReassignCallId] = useState<number | null>(null);
  const [reassignUserId, setReassignUserId] = useState('');
  const canReassign = user?.role === 'admin' || user?.role === 'franchise_owner';
  const [showBulkReassignDialog, setShowBulkReassignDialog] = useState(false);
  const [bulkReassignUserId, setBulkReassignUserId] = useState('');
  const canAssign = ['admin', 'franchise_owner', 'director', 'sales_manager', 'sales_supervisor', 'team_leader'].includes(user?.role ?? '');

  const visibleUserIds = getVisibleUserIds(user, users);
  const scopedCalls = coldCalls.filter(call => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'franchise_owner') return true;
    const assignedVisible = call.assignedToId && visibleUserIds.includes(call.assignedToId);
    const teamLeaderVisible = call.teamLeaderId && visibleUserIds.includes(call.teamLeaderId);
    return assignedVisible || teamLeaderVisible;
  });

  // Get status counts
  const getStatusCount = (statusName: string) => {
    if (statusName === 'All') return scopedCalls.length;
    return scopedCalls.filter(call => call.status === statusName).length;
  };

  // Filter cold calls
  const filteredCalls = scopedCalls.filter(call => {
    const matchesSearch = 
      call.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.phone.includes(searchTerm);
    
    const matchesStatus = selectedStatus === 'All' || call.status === selectedStatus;
    
    const matchesPotential = 
      potentialFilter === 'all' || 
      (potentialFilter === 'potential' && call.isPotential) ||
      (potentialFilter === 'non-potential' && !call.isPotential);
    
    const matchesAssignee =
      filterAssignee === 'all' ||
      (call.assignedToId && call.assignedToId.toString() === filterAssignee);
    const matchesTeamLeader =
      filterTeamLeader === 'all' ||
      (call.teamLeaderId && call.teamLeaderId.toString() === filterTeamLeader);

    return matchesSearch && matchesStatus && matchesPotential && matchesAssignee && matchesTeamLeader;
  });

  // Pagination
  const totalPages = Math.ceil(filteredCalls.length / showEntries);
  const paginatedCalls = filteredCalls.slice(
    (currentPage - 1) * showEntries,
    currentPage * showEntries
  );

  const toggleCallSelection = (callId: number) => {
    setSelectedCalls(prev => 
      prev.includes(callId) 
        ? prev.filter(id => id !== callId)
        : [...prev, callId]
    );
  };

  const toggleAllSelection = () => {
    if (selectedCalls.length === paginatedCalls.length) {
      setSelectedCalls([]);
    } else {
      setSelectedCalls(paginatedCalls.map(call => call.id));
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
    if (!reassignCallId || !reassignUserId) {
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
      await jsonRequest(`cold-calls/${reassignCallId}`, {
        method: 'PUT',
        body: { assignedToId: assignee.id, teamLeaderId: teamLeader?.id },
      });
      setColdCalls(prev =>
        prev.map(call =>
          call.id === reassignCallId
            ? {
                ...call,
                assignedTo: assignee.name,
                assignedToId: assignee.id,
                teamLeaderId: teamLeader?.id,
                teamLeader: teamLeader?.name,
              }
            : call
        )
      );
      toast.success('Cold call reassigned');
      setShowReassignDialog(false);
      setReassignCallId(null);
      setReassignUserId('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleBulkReassign = async () => {
    if (selectedCalls.length === 0) {
      toast.error('Select at least one cold call to reassign');
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
        selectedCalls.map((callId) =>
          jsonRequest(`cold-calls/${callId}`, {
            method: 'PUT',
            body: { assignedToId: assignee.id, teamLeaderId: teamLeader?.id },
          })
        )
      );
      setColdCalls(prev =>
        prev.map(call =>
          selectedCalls.includes(call.id)
            ? {
                ...call,
                assignedTo: assignee.name,
                assignedToId: assignee.id,
                teamLeaderId: teamLeader?.id,
                teamLeader: teamLeader?.name,
              }
            : call
        )
      );
      toast.success(`Reassigned ${selectedCalls.length} cold calls`);
      setSelectedCalls([]);
      setShowBulkReassignDialog(false);
      setBulkReassignUserId('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleAddColdCall = async () => {
    if (!newCallName.trim() || !newCallPhone.trim() || !newCallStatus) {
      toast.error('Please fill in name, phone, and status');
      return;
    }

    const statusObj = statuses.find(s => s.name === newCallStatus);
    const isPotential =
      newCallStatus.toLowerCase().includes('potential') &&
      !newCallStatus.toLowerCase().includes('non');

    try {
      const created = await jsonRequest<{ ok: boolean; id?: number }>('cold-calls', {
        method: 'POST',
        body: {
          name: newCallName.trim(),
          phone: newCallPhone.trim(),
          statusId: statusObj?.id ?? 0,
          date: new Date().toISOString().split('T')[0],
        },
      });

      const nextId = created.id ?? (coldCalls.length > 0 ? Math.max(...coldCalls.map(c => c.id)) + 1 : 1);
      setColdCalls(prev => [
        ...prev,
        {
          id: nextId,
          type: 'Coldcall',
          name: newCallName.trim(),
          phone: newCallPhone.trim(),
          status: newCallStatus,
          statusId: statusObj?.id ?? 0,
          date: new Date().toISOString().split('T')[0],
          isPotential,
        },
      ]);

      toast.success('Cold call added successfully!');
      setShowAddDialog(false);
      setNewCallName('');
      setNewCallPhone('');
      setNewCallStatus('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedCalls.length === 0) {
      return;
    }
    try {
      await Promise.all(selectedCalls.map((callId) => jsonRequest(`cold-calls/${callId}`, { method: 'DELETE' })));
      setColdCalls(prev => prev.filter(call => !selectedCalls.includes(call.id)));
      toast.success(`Deleted ${selectedCalls.length} cold calls`);
      setSelectedCalls([]);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleAssignSelected = async () => {
    if (!assignAgentId && !assignTeamLeaderId) {
      toast.error('Select an agent or team leader');
      return;
    }

    const agent = users.find(u => u.id.toString() === assignAgentId);
    const teamLeader = users.find(u => u.id.toString() === assignTeamLeaderId);

    try {
      await Promise.all(
        selectedCalls.map((callId) =>
          jsonRequest(`cold-calls/${callId}`, {
            method: 'PUT',
            body: {
              assignedToId: agent?.id || teamLeader?.id,
              teamLeaderId: teamLeader?.id ?? agent?.teamLeaderId,
            },
          })
        )
      );
      setColdCalls(prev =>
        prev.map(call =>
          selectedCalls.includes(call.id)
            ? {
                ...call,
                assignedTo: agent?.name || call.assignedTo,
                assignedToId: agent?.id || call.assignedToId,
                teamLeader: teamLeader?.name || call.teamLeader,
                teamLeaderId: teamLeader?.id || call.teamLeaderId,
              }
            : call
        )
      );

      toast.success('Assignment updated');
      setSelectedCalls([]);
      setAssignAgentId('');
      setAssignTeamLeaderId('');
      setShowAssignDialog(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const openEditDialog = (callId: number, currentStatus: string) => {
    setEditCallId(callId);
    setEditStatus(currentStatus);
    setEditComment('');
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editCallId) return;
    if (!editComment.trim()) {
      toast.error('Comment is required');
      return;
    }

    const statusObj = statuses.find(s => s.name === editStatus);
    const isPotential =
      editStatus.toLowerCase().includes('potential') &&
      !editStatus.toLowerCase().includes('non');

    try {
      await jsonRequest(`cold-calls/${editCallId}`, {
        method: 'PUT',
        body: {
          statusId: statusObj?.id ?? undefined,
        },
      });

      const createdBy = user?.name || 'Unknown';
      const createdById = user?.id || 0;
      const created = await jsonRequest<{ ok: boolean; id?: number }>('comments', {
        method: 'POST',
        body: {
          leadId: editCallId,
          entityType: 'cold_call',
          entityId: editCallId,
          content: editComment.trim(),
          createdBy,
          createdById,
        },
      });

      setColdCalls(prev =>
        prev.map(call =>
          call.id === editCallId
            ? {
                ...call,
                status: editStatus,
                statusId: statusObj?.id ?? call.statusId,
                isPotential,
              }
            : call
        )
      );

      const nextId = created.id ?? (comments.length > 0 ? Math.max(...comments.map(c => c.id)) + 1 : 1);
      setComments(prev => [
        ...prev,
        {
          id: nextId,
          leadId: editCallId,
          entityType: 'cold_call',
          entityId: editCallId,
          content: editComment.trim(),
          createdBy,
          createdById,
          createdAt: new Date().toLocaleString(),
        },
      ]);

      toast.success('Cold call updated and comment added');
      setShowEditDialog(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const exportSelectedToExcel = () => {
    if (selectedCalls.length === 0) {
      toast.error('Select at least one cold call to export');
      return;
    }
    const selected = coldCalls.filter(call => selectedCalls.includes(call.id));
    const rows = selected.map(call => ({
      ID: call.id,
      Name: call.name,
      Phone: call.phone,
      Status: call.status,
      AssignedTo: call.assignedTo || '',
      TeamLeader: call.teamLeader || '',
      Date: call.date || '',
      Potential: call.isPotential ? 'Yes' : 'No',
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SelectedColdCalls');
    XLSX.writeFile(workbook, `selected-coldcalls-${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success('Exported selected cold calls to Excel');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Cold Calls List</h1>
          <Badge variant="secondary" className="text-lg">
            {filteredCalls.length}
          </Badge>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowFilters((prev) => !prev)}>
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="default">
                <Plus className="w-4 h-4 mr-2" />
                Add New coldcall
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Cold Call</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input placeholder="Name" value={newCallName} onChange={(e) => setNewCallName(e.target.value)} />
                <Input placeholder="Phone" value={newCallPhone} onChange={(e) => setNewCallPhone(e.target.value)} />
                <Select value={newCallStatus} onValueChange={setNewCallStatus}>
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
                <Button onClick={handleAddColdCall}>
                  Save Cold Call
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="default"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => toast.success('Exported all cold calls to Excel!')}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export All to Excel
          </Button>
          {canAssign && (
            <Button
              variant="default"
              className="bg-cyan-500 hover:bg-cyan-600"
              onClick={() => {
                if (selectedCalls.length === 0) {
                  toast.error('Select at least one cold call to assign');
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
                if (selectedCalls.length === 0) {
                  toast.error('Select at least one cold call to reassign');
                  return;
                }
                setShowBulkReassignDialog(true);
              }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Reassign
            </Button>
          )}
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
              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Filter by Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {users.filter(u => u.role === 'agent').map(agent => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterTeamLeader} onValueChange={setFilterTeamLeader}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Filter by Team Leader" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Leaders</SelectItem>
                  {users.filter(u => u.role === 'team_leader').map(tl => (
                    <SelectItem key={tl.id} value={tl.id.toString()}>
                      {tl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Potential Filters */}
      <div className="flex gap-2">
        <Button
          variant={potentialFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setPotentialFilter('all')}
          size="sm"
        >
          All
        </Button>
        <Button
          variant={potentialFilter === 'potential' ? 'default' : 'outline'}
          onClick={() => setPotentialFilter('potential')}
          size="sm"
          className={potentialFilter === 'potential' ? 'bg-green-600' : ''}
        >
          <Target className="w-4 h-4 mr-2" />
          Potentials
        </Button>
        <Button
          variant={potentialFilter === 'non-potential' ? 'default' : 'outline'}
          onClick={() => setPotentialFilter('non-potential')}
          size="sm"
          className={potentialFilter === 'non-potential' ? 'bg-gray-600' : ''}
        >
          <XCircle className="w-4 h-4 mr-2" />
          Non Potentials
        </Button>
      </div>

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

            <div className="flex gap-2 flex-wrap">
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
              {selectedCalls.length > 0 && (
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

      {/* Cold Calls Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={selectedCalls.length === paginatedCalls.length && paginatedCalls.length > 0}
                      onCheckedChange={toggleAllSelection}
                    />
                  </TableHead>
                  {visibleColumns.id && <TableHead>#</TableHead>}
                  {visibleColumns.type && <TableHead>Type</TableHead>}
                  {visibleColumns.name && <TableHead>Name</TableHead>}
                  {visibleColumns.phone && <TableHead>Phone</TableHead>}
                  {visibleColumns.status && <TableHead>Status</TableHead>}
                  {visibleColumns.assignedTo && <TableHead>Assign To</TableHead>}
                  {visibleColumns.teamLeader && <TableHead>Team Leader</TableHead>}
                  {visibleColumns.potential && <TableHead>Potential</TableHead>}
                  {visibleColumns.action && <TableHead>Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCalls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedCalls.includes(call.id)}
                        onCheckedChange={() => toggleCallSelection(call.id)}
                      />
                    </TableCell>
                    {visibleColumns.id && <TableCell className="font-medium">{call.id}</TableCell>}
                    {visibleColumns.type && (
                      <TableCell>
                        <Badge variant="outline">{call.type}</Badge>
                      </TableCell>
                    )}
                    {visibleColumns.name && <TableCell>{call.name}</TableCell>}
                    {visibleColumns.phone && <TableCell>{call.phone}</TableCell>}
                    {visibleColumns.status && (
                      <TableCell>
                        <Badge 
                          style={{ 
                            backgroundColor: getStatusColor(call.status),
                            color: 'white'
                          }}
                        >
                          {call.status}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleColumns.assignedTo && <TableCell>{call.assignedTo || '-'}</TableCell>}
                    {visibleColumns.teamLeader && <TableCell>{call.teamLeader || '-'}</TableCell>}
                    {visibleColumns.potential && (
                      <TableCell>
                        {call.isPotential ? (
                          <Badge className="bg-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="w-3 h-3 mr-1" />
                            No
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.action && (
                      <TableCell>
                        <div className="flex gap-1">
                          {getCallHref(call.phone) ? (
                            <Button asChild variant="outline" size="icon" className="h-8 w-8">
                              <a href={getCallHref(call.phone)}>
                                <Phone className="w-4 h-4 text-green-600" />
                              </a>
                            </Button>
                          ) : (
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                              <Phone className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          {getWhatsAppHref(call.phone) ? (
                            <Button asChild variant="default" size="icon" className="h-8 w-8 bg-green-500 hover:bg-green-600">
                              <a href={getWhatsAppHref(call.phone)} target="_blank" rel="noreferrer">
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
                            onClick={() => openEditDialog(call.id, call.status)}
                          >
                            <Edit className="w-4 h-4 text-gray-600" />
                          </Button>
                        </div>
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
              {Math.min(currentPage * showEntries, filteredCalls.length)} of{' '}
              {filteredCalls.length} entries
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
            <DialogTitle>Assign Selected Cold Calls</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={assignAgentId} onValueChange={setAssignAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Agent" />
              </SelectTrigger>
              <SelectContent>
                {users.filter(u => u.role === 'agent').map(agent => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={assignTeamLeaderId} onValueChange={setAssignTeamLeaderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Team Leader" />
              </SelectTrigger>
              <SelectContent>
                {users.filter(u => u.role === 'team_leader').map(tl => (
                  <SelectItem key={tl.id} value={tl.id.toString()}>
                    {tl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssignSelected}>
              Apply Assignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkReassignDialog} onOpenChange={setShowBulkReassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Selected Cold Calls</DialogTitle>
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
            <DialogTitle>Reassign Cold Call</DialogTitle>
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

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Cold Call</DialogTitle>
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
            <textarea
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              rows={4}
              placeholder="Comment (required)"
              value={editComment}
              onChange={(e) => setEditComment(e.target.value)}
            />
            <Button onClick={handleSaveEdit} disabled={!editCallId}>
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
