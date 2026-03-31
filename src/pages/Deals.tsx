import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/hooks/useAuth';
import { calculateCommission } from '@/data/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { getVisibleUserIds } from '@/lib/hierarchy';
import type { DealFileItem } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  Filter, 
  Handshake, 
  Banknote,
  Calendar,
  User,
  Building2,
  Phone,
  MessageCircle,
  Eye,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { jsonRequest } from '@/lib/mutations';

export default function Deals() {
  const { deals, setDeals, users, projects, developers } = useData();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newAgentId, setNewAgentId] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newReservationPrice, setNewReservationPrice] = useState('');
  const [newReservationDate, setNewReservationDate] = useState('');
  const [newContractPrice, setNewContractPrice] = useState('');
  const [newContractDate, setNewContractDate] = useState('');
  const [newUnitNumber, setNewUnitNumber] = useState('');
  const [newStage, setNewStage] = useState('');
  const [newCommission, setNewCommission] = useState('');
  const [newStatus, setNewStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selectedDeal, setSelectedDeal] = useState<(typeof deals)[0] | null>(null);
  const [newAttachments, setNewAttachments] = useState<DealFileItem[]>([]);
  const [newReservationImages, setNewReservationImages] = useState<DealFileItem[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const canDateFilter = user?.role === 'admin' || user?.role === 'franchise_owner';
  const canManageDeals = user?.role === 'admin' || user?.role === 'franchise_owner';

  const visibleUserIds = getVisibleUserIds(user, users);
  const visibleDeals = deals.filter(deal => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'franchise_owner') return true;
    return visibleUserIds.includes(deal.agentId);
  });

  // Calculate total commission
  const totalCommission = visibleDeals.reduce((sum, deal) => sum + deal.commission, 0);
  const totalAmount = visibleDeals.reduce((sum, deal) => sum + deal.amount, 0);

  // Filter deals
  const filteredDeals = visibleDeals.filter(deal => {
    const matchesSearch = 
      deal.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (deal.clientPhone || '').includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || deal.status === statusFilter;
    const dealDate = deal.date || '';
    const matchesDate =
      (!filterDateFrom || (dealDate && dealDate >= filterDateFrom)) &&
      (!filterDateTo || (dealDate && dealDate <= filterDateTo));
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatMoney = (value?: number) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '-';
    return value.toLocaleString();
  };

  const sanitizePhone = (phone?: string) => (phone ? phone.replace(/\D/g, '') : '');

  const fileToPayload = (file: File): Promise<DealFileItem> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          name: file.name,
          url: String(reader.result ?? ''),
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        });
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const filesToPayload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return [];
    return Promise.all(Array.from(fileList).map((file) => fileToPayload(file)));
  };

  const appendFilesToDeal = async (
    target: 'attachments' | 'reservationImages',
    files: FileList | null
  ) => {
    if (!selectedDeal) return;
    const payload = await filesToPayload(files);
    if (payload.length === 0) return;
    const nextAttachments =
      target === 'attachments'
        ? [...((selectedDeal.attachments ?? []) as DealFileItem[]), ...payload]
        : selectedDeal.attachments ?? [];
    const nextReservationImages =
      target === 'reservationImages'
        ? [...((selectedDeal.reservationImages ?? []) as DealFileItem[]), ...payload]
        : selectedDeal.reservationImages ?? [];
    try {
      await jsonRequest(`deals/${selectedDeal.id}`, {
        method: 'PUT',
        body: {
          ...selectedDeal,
          attachments: nextAttachments,
          reservationImages: nextReservationImages,
        },
      });
      setDeals(prev =>
        prev.map(deal =>
          deal.id === selectedDeal.id
            ? {
                ...deal,
                attachments: nextAttachments,
                reservationImages: nextReservationImages,
              }
            : deal
        )
      );
      setSelectedDeal(prev =>
        prev
          ? {
              ...prev,
              attachments: nextAttachments,
              reservationImages: nextReservationImages,
            }
          : prev
      );
      toast.success(`${target === 'attachments' ? 'Attachments' : 'Reservation images'} added`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleAddDeal = async () => {
    if (
      !newClientName.trim() ||
      !newClientPhone.trim() ||
      !newAgentId ||
      !newProjectId ||
      !newReservationPrice ||
      !newReservationDate ||
      !newContractPrice ||
      !newContractDate ||
      !newUnitNumber.trim() ||
      !newStage
    ) {
      toast.error('Please fill in all deal fields');
      return;
    }

    const clientName = newClientName.trim();
    const clientPhone = newClientPhone.trim();
    const agent = users.find(u => u.id.toString() === newAgentId);
    const project = projects.find(p => p.id.toString() === newProjectId);
    const developer = developers.find(d => d.id === project?.developerId);

    if (!agent || !project) {
      toast.error('Invalid agent or project');
      return;
    }

    const reservationPrice = Number(newReservationPrice);
    const contractPrice = Number(newContractPrice);
    if (Number.isNaN(reservationPrice) || reservationPrice <= 0) {
      toast.error('Enter a valid reservation price');
      return;
    }
    if (Number.isNaN(contractPrice) || contractPrice <= 0) {
      toast.error('Enter a valid contract price');
      return;
    }

    const amount = contractPrice;
    const autoCommission = calculateCommission(amount);
    const commission = newCommission ? Number(newCommission) : autoCommission;
    if (Number.isNaN(commission) || commission < 0) {
      toast.error('Enter a valid commission');
      return;
    }

    try {
      const created = await jsonRequest<{ ok: boolean; id?: number }>('deals', {
        method: 'POST',
        body: {
          leadName: clientName,
          clientPhone,
          agentId: agent.id,
          projectId: project.id,
          developerId: project.developerId,
          amount,
          commission,
          status: newStatus,
          stage: newStage,
          reservationPrice,
          reservationDate: newReservationDate,
          contractPrice,
          contractDate: newContractDate,
          unitNumber: newUnitNumber.trim(),
          createdAt: new Date().toISOString(),
          date: newContractDate,
          attachments: newAttachments,
          reservationImages: newReservationImages,
        },
      });

      const nextId = created.id ?? (deals.length > 0 ? Math.max(...deals.map(d => d.id)) + 1 : 1);
      setDeals(prev => [
        ...prev,
        {
          id: nextId,
          leadId: Date.now(),
          leadName: clientName,
          clientPhone,
          agentId: agent.id,
          agentName: agent.name,
          projectId: project.id,
          projectName: project.name,
          developerId: project.developerId,
          developerName: developer?.name || '',
          amount,
          commission,
          status: newStatus,
          stage: newStage,
          reservationPrice,
          reservationDate: newReservationDate,
          contractPrice,
          contractDate: newContractDate,
          unitNumber: newUnitNumber.trim(),
          createdAt: new Date().toLocaleString(),
          date: newContractDate,
          attachments: newAttachments,
          reservationImages: newReservationImages,
        },
      ]);

      toast.success('Deal added successfully!');
      setShowAddDialog(false);
      setNewClientName('');
      setNewClientPhone('');
      setNewAgentId('');
      setNewProjectId('');
      setNewReservationPrice('');
      setNewReservationDate('');
      setNewContractPrice('');
      setNewContractDate('');
      setNewUnitNumber('');
      setNewStage('');
      setNewCommission('');
      setNewStatus('pending');
      setNewAttachments([]);
      setNewReservationImages([]);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deals Management</h1>
          <p className="text-gray-500 mt-1">Manage and track all closed deals</p>
        </div>
        {canManageDeals && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Deal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Deal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Client Name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                />
                <Input
                  placeholder="Client Phone"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                />
                <Select value={newAgentId} onValueChange={setNewAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newProjectId} onValueChange={setNewProjectId}>
                  <SelectTrigger>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    placeholder="Reservation Price (EGP)"
                    type="number"
                    value={newReservationPrice}
                    onChange={(e) => setNewReservationPrice(e.target.value)}
                  />
                  <Input
                    placeholder="Reservation Date"
                    type="date"
                    value={newReservationDate}
                    onChange={(e) => setNewReservationDate(e.target.value)}
                  />
                  <Input
                    placeholder="Contract Price (EGP)"
                    type="number"
                    value={newContractPrice}
                    onChange={(e) => setNewContractPrice(e.target.value)}
                  />
                  <Input
                    placeholder="Contract Date"
                    type="date"
                    value={newContractDate}
                    onChange={(e) => setNewContractDate(e.target.value)}
                  />
                  <Input
                    placeholder="Unit Number"
                    value={newUnitNumber}
                    onChange={(e) => setNewUnitNumber(e.target.value)}
                  />
                  <Select value={newStage} onValueChange={setNewStage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Deal Stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Meeting">Meeting</SelectItem>
                      <SelectItem value="EOI">EOI</SelectItem>
                      <SelectItem value="Reservation">Reservation</SelectItem>
                      <SelectItem value="Contracted">Contracted</SelectItem>
                      <SelectItem value="Deal Done">Deal Done</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Attachments</p>
                  <Input
                    type="file"
                    multiple
                    onChange={async (e) => setNewAttachments(await filesToPayload(e.target.files))}
                  />
                  {newAttachments.length > 0 ? (
                    <p className="text-xs text-gray-500">{newAttachments.length} file(s) selected</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Reservation Images</p>
                  <Input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={async (e) => setNewReservationImages(await filesToPayload(e.target.files))}
                  />
                  {newReservationImages.length > 0 ? (
                    <p className="text-xs text-gray-500">{newReservationImages.length} file(s) selected</p>
                  ) : null}
                </div>
                <Input
                  placeholder={`Commission (EGP) - default ${newContractPrice ? calculateCommission(Number(newContractPrice)).toLocaleString() : 0}`}
                  type="number"
                  value={newCommission}
                  onChange={(e) => setNewCommission(e.target.value)}
                />
                <Select value={newStatus} onValueChange={(value) => setNewStatus(value as 'pending' | 'approved' | 'rejected')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Commission Calculation:</strong> 5,000 EGP for each 1 Million EGP of deal value
                  </p>
                </div>
                <Button onClick={handleAddDeal}>
                  Save Deal
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Deals</p>
                <p className="text-2xl font-bold text-gray-900">{visibleDeals.length}</p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                <Handshake className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Deal Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(totalAmount / 1000000).toFixed(0)}M EGP
                </p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg">
                <Banknote className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Commission</p>
                <p className="text-2xl font-bold text-gray-900">
                  {totalCommission.toLocaleString()} EGP
                </p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg">
                <Banknote className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              5,000 EGP per million
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search deals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canDateFilter && (
            <div className="mt-4 flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-[180px]">
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  placeholder="From"
                />
              </div>
              <div className="w-full sm:w-[180px]">
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

      {/* Deals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Deals List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal #</TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Developer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeals.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell className="font-medium">#{deal.id}</TableCell>
                    <TableCell>{deal.leadName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        {deal.agentName}
                      </div>
                    </TableCell>
                    <TableCell>{deal.projectName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {deal.developerName}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {(deal.amount / 1000000).toFixed(0)}M EGP
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {deal.commission.toLocaleString()} EGP
                    </TableCell>
                    <TableCell>{getStatusBadge(deal.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {deal.date}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setSelectedDeal(deal)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredDeals.length === 0 && (
            <div className="text-center py-8">
              <Handshake className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No deals found</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedDeal} onOpenChange={() => setSelectedDeal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle>Deal Details</DialogTitle>
          </DialogHeader>
          {selectedDeal && (
            <div className="space-y-4 pb-2 pr-1">
              <div className="flex items-center justify-between p-4 border rounded-xl bg-white">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedDeal.leadName}
                  </p>
                  <p className="text-xs text-gray-500">
                    Created: {selectedDeal.createdAt || selectedDeal.date}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!sanitizePhone(selectedDeal.clientPhone)}
                    onClick={() => {
                      const phone = sanitizePhone(selectedDeal.clientPhone);
                      if (phone) window.open(`tel:${phone}`);
                    }}
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!sanitizePhone(selectedDeal.clientPhone)}
                    onClick={() => {
                      const phone = sanitizePhone(selectedDeal.clientPhone);
                      if (phone) window.open(`https://wa.me/${phone}`);
                    }}
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="inline-flex items-center rounded-full bg-black text-white text-xs px-3 py-1">
                Overview
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">ID</p>
                  <div className="mt-1 p-3 border rounded-lg">{selectedDeal.id}</div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <div className="mt-1 p-3 border rounded-lg">
                    {selectedDeal.stage || '—'}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Agent</p>
                  <div className="mt-1 p-3 border rounded-lg">{selectedDeal.agentName}</div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Client Name</p>
                  <div className="mt-1 p-3 border rounded-lg">{selectedDeal.leadName}</div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Reservation Price</p>
                  <div className="mt-1 p-3 border rounded-lg">
                    {formatMoney(selectedDeal.reservationPrice)}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Reservation Date</p>
                  <div className="mt-1 p-3 border rounded-lg">
                    {selectedDeal.reservationDate || '-'}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Contract Price</p>
                  <div className="mt-1 p-3 border rounded-lg">
                    {formatMoney(selectedDeal.contractPrice)}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Contract Date</p>
                  <div className="mt-1 p-3 border rounded-lg">
                    {selectedDeal.contractDate || '-'}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Unit Number</p>
                  <div className="mt-1 p-3 border rounded-lg">
                    {selectedDeal.unitNumber || '-'}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Project</p>
                  <div className="mt-1 p-3 border rounded-lg">{selectedDeal.projectName}</div>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-gray-500">Developer</p>
                  <div className="mt-1 p-3 border rounded-lg">{selectedDeal.developerName}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3 p-4 border rounded-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Attachments</p>
                      <p className="text-xs text-gray-500">Upload contracts, IDs, or notes.</p>
                    </div>
                    <Input
                      type="file"
                      multiple
                      className="max-w-48"
                      onChange={async (e) => appendFilesToDeal('attachments', e.target.files)}
                    />
                  </div>
                  <div className="space-y-2">
                    {(selectedDeal.attachments ?? []).length === 0 ? (
                      <p className="text-sm text-gray-500">No attachments yet.</p>
                    ) : (
                      (selectedDeal.attachments ?? []).map((file) => (
                        <a
                          key={`${file.name}-${file.uploadedAt ?? ''}`}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg border p-3 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {file.name}
                        </a>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-3 p-4 border rounded-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Reservation Images</p>
                      <p className="text-xs text-gray-500">Upload reservation proof or images.</p>
                    </div>
                    <Input
                      type="file"
                      multiple
                      accept="image/*"
                      className="max-w-48"
                      onChange={async (e) => appendFilesToDeal('reservationImages', e.target.files)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(selectedDeal.reservationImages ?? []).length === 0 ? (
                      <p className="text-sm text-gray-500 col-span-2">No reservation images yet.</p>
                    ) : (
                      (selectedDeal.reservationImages ?? []).map((file) => (
                        <a
                          key={`${file.name}-${file.uploadedAt ?? ''}`}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-lg border bg-gray-50"
                        >
                          <img src={file.url} alt={file.name} className="h-28 w-full object-cover" />
                        </a>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Commission Info */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
              <Banknote className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Commission Calculation</h3>
              <p className="text-sm text-gray-600 mt-1">
                Commission is calculated at <strong>5,000 EGP</strong> for every <strong>1 Million EGP</strong> of deal value.
              </p>
              <div className="mt-3 p-3 bg-white rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Example:</strong> If an agent closes a deal worth 10,000,000 EGP, 
                  the commission would be: (10,000,000 ÷ 1,000,000) × 5,000 = <strong>50,000 EGP</strong>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
