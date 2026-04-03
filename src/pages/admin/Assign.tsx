import { useEffect, useState } from 'react';
import { useData } from '@/contexts/DataContext';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  PhoneCall,
  Search,
  CheckCircle,
  UserCog
} from 'lucide-react';
import { toast } from 'sonner';
import { jsonRequest } from '@/lib/mutations';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

const syncOrder = (currentOrder: number[], items: Array<{ id: number }>) => {
  const ids = items.map((item) => item.id);
  const seen = new Set<number>();
  const orderedExisting = currentOrder.filter((id) => ids.includes(id) && !seen.has(id) && (seen.add(id), true));
  const appendedNew = ids.filter((id) => !orderedExisting.includes(id));
  return [...orderedExisting, ...appendedNew];
};

const moveIdsToBottom = (currentOrder: number[], idsToMove: number[]) => {
  const selected = currentOrder.filter((id) => idsToMove.includes(id));
  const remaining = currentOrder.filter((id) => !idsToMove.includes(id));
  return [...remaining, ...selected];
};

const isAssignedItem = (item: {
  assignedToId?: number | null;
  teamLeaderId?: number | null;
  assignedTo?: string | null;
  teamLeader?: string | null;
}) => Boolean(item.assignedToId || item.teamLeaderId || item.assignedTo || item.teamLeader);

export default function AdminAssign() {
  const { leads, setLeads, coldCalls, setColdCalls, users, statuses, projects } = useData();
  const [activeTab, setActiveTab] = useState('leads');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [selectedTeamLeader, setSelectedTeamLeader] = useState<string>('');
  const [filterAssignedTeamLeader, setFilterAssignedTeamLeader] = useState<string>('all');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [leadOrder, setLeadOrder] = useState<number[]>([]);
  const [coldCallOrder, setColdCallOrder] = useState<number[]>([]);

  useEffect(() => {
    setSelectedItems([]);
  }, [activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, filterAssignedTeamLeader, pageSize]);

  useEffect(() => {
    setLeadOrder((prev) => syncOrder(prev, leads));
  }, [leads]);

  useEffect(() => {
    setColdCallOrder((prev) => syncOrder(prev, coldCalls));
  }, [coldCalls]);

  // Get assignment targets
  const directorsAndSalesManagers = users.filter(
    u => u.role === 'director' || u.role === 'sales_manager'
  );

  // Get items based on active tab
  const items = activeTab === 'leads' ? leads : coldCalls;
  const itemOrder = activeTab === 'leads' ? leadOrder : coldCallOrder;
  const orderIndex = new Map(itemOrder.map((id, index) => [id, index]));
  const orderedItems = [...items].sort((a, b) => {
    const aAssigned = isAssignedItem(a);
    const bAssigned = isAssignedItem(b);
    if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;

    const aIndex = orderIndex.has(a.id) ? orderIndex.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const bIndex = orderIndex.has(b.id) ? orderIndex.get(b.id)! : Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.id - b.id;
  });

  // Filter items
  const filteredItems = orderedItems.filter(item => {
    const matchesAssignedTeamLeader =
      filterAssignedTeamLeader === 'all' ||
      (item.teamLeaderId && item.teamLeaderId.toString() === filterAssignedTeamLeader);
    return (
      matchesAssignedTeamLeader &&
      (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.phone.includes(searchTerm))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const currentPageItems = filteredItems.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const toggleItemSelection = (itemId: number) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleAllSelection = () => {
    if (selectedItems.length === currentPageItems.length && currentPageItems.length > 0) {
      setSelectedItems([]);
    } else {
      setSelectedItems(currentPageItems.map(item => item.id));
    }
  };

  const handleAssignTeamLeader = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item');
      return;
    }
    if (!selectedTeamLeader) {
      toast.error('Please select a team leader');
      return;
    }

    const targetUser = directorsAndSalesManagers.find(t => t.id.toString() === selectedTeamLeader);
    if (!targetUser) return;

    try {
      const endpoint = activeTab === 'leads' ? 'leads' : 'cold-calls';
      await Promise.all(
        selectedItems.map((itemId) =>
          jsonRequest(`${endpoint}/${itemId}`, {
            method: 'PUT',
            body: { assignedToId: targetUser.id, teamLeaderId: targetUser.id },
          })
        )
      );

      if (activeTab === 'leads') {
        setLeads(prev =>
          prev.map(item =>
            selectedItems.includes(item.id)
              ? { ...item, assignedTo: targetUser.name, assignedToId: targetUser.id, teamLeader: targetUser.name, teamLeaderId: targetUser.id }
              : item
          )
        );
        setLeadOrder((prev) => moveIdsToBottom(prev, selectedItems));
      } else {
        setColdCalls(prev =>
          prev.map(item =>
            selectedItems.includes(item.id)
              ? { ...item, assignedTo: targetUser.name, assignedToId: targetUser.id, teamLeader: targetUser.name, teamLeaderId: targetUser.id }
              : item
          )
        );
        setColdCallOrder((prev) => moveIdsToBottom(prev, selectedItems));
      }

      toast.success(`Assigned ${selectedItems.length} ${activeTab} to ${targetUser.name}`);
      setSelectedItems([]);
      setSelectedTeamLeader('');
      setFilterAssignedTeamLeader('all');
      setCurrentPage(1);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleProjectAssign = async (itemId: number, projectId: string, target: 'leads' | 'coldcalls') => {
    const project = projects.find(p => p.id.toString() === projectId);
    if (!project) return;
    try {
      await jsonRequest(`${target === 'leads' ? 'leads' : 'cold-calls'}/${itemId}`, {
        method: 'PUT',
        body: { projectId: project.id },
      });

      const update = (prevItems: typeof items) =>
        prevItems.map(item =>
          item.id === itemId
            ? { ...item, project: project.name, projectId: project.id }
            : item
        );

      if (target === 'leads') {
        setLeads(update);
      } else {
        setColdCalls(update);
      }
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const getStatusColor = (statusName: string) => {
    const status = statuses.find(s => s.name === statusName);
    return status?.color || '#6B7280';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assign Leads & Cold Calls</h1>
        <p className="text-gray-500 mt-1">
          Assign leads and cold calls to directors or sales managers
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Leads ({leads.length})
          </TabsTrigger>
          <TabsTrigger value="coldcalls" className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4" />
            Cold Calls ({coldCalls.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          {/* Assignment Controls */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-500">
                    Show
                  </span>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <Button
                      key={size}
                      type="button"
                      variant={pageSize === size ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPageSize(size)}
                      className="h-9 min-w-12 px-3"
                    >
                      {size}
                    </Button>
                  ))}
                  <span className="text-sm text-gray-500">
                    entries
                  </span>
                </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    Selected: <strong>{selectedItems.length}</strong>
                  </span>
                </div>

                <div className="flex-1 flex flex-wrap gap-3 items-center">
                 <Select value={selectedTeamLeader} onValueChange={setSelectedTeamLeader}>
                    <SelectTrigger className="w-[300px] max-w-full h-11 min-w-0 overflow-hidden text-base font-medium justify-start gap-3">
                      <UserCog className="w-4 h-4 mr-2" />
                      <SelectValue className="min-w-0 flex-1 truncate text-left" placeholder="Select Director or Sales Manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {directorsAndSalesManagers.map(target => (
                        <SelectItem key={target.id} value={target.id.toString()}>
                          {target.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button 
                    variant="outline" 
                    onClick={handleAssignTeamLeader} 
                    disabled={selectedItems.length === 0 || !selectedTeamLeader}
                    className="h-11 w-[320px] max-w-full whitespace-nowrap"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Assign to Director / Sales Manager
                  </Button>
                </div>

                <Select value={filterAssignedTeamLeader} onValueChange={setFilterAssignedTeamLeader}>
                  <SelectTrigger className="w-[300px] max-w-full h-11 min-w-0 overflow-hidden text-base font-medium justify-start gap-3">
                    <UserCog className="w-4 h-4 mr-2" />
                    <SelectValue className="min-w-0 flex-1 truncate text-left" placeholder="Filter by Director / Sales Manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Directors / Sales Managers</SelectItem>
                    {directorsAndSalesManagers.map(target => (
                      <SelectItem key={target.id} value={target.id.toString()}>
                        {target.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-[200px]"
                  />
                </div>
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
                          checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                          onCheckedChange={toggleAllSelection}
                        />
                      </TableHead>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Current Assignee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPageItems.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedItems.includes(lead.id)}
                            onCheckedChange={() => toggleItemSelection(lead.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{lead.id}</TableCell>
                        <TableCell>{lead.name}</TableCell>
                        <TableCell>{lead.phone}</TableCell>
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
                        <TableCell>
                          <Select
                            value={lead.projectId ? lead.projectId.toString() : ''}
                            onValueChange={(value) => handleProjectAssign(lead.id, value, 'leads')}
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
                        <TableCell>{lead.assignedTo || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-t">
                <p className="text-sm text-gray-500">
                  Showing {(safeCurrentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(safeCurrentPage * pageSize, filteredItems.length)} of {filteredItems.length} entries
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={safeCurrentPage === 1}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={safeCurrentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coldcalls" className="space-y-4">
          {/* Assignment Controls */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-500">
                    Show
                  </span>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <Button
                      key={size}
                      type="button"
                      variant={pageSize === size ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPageSize(size)}
                      className="h-9 min-w-12 px-3"
                    >
                      {size}
                    </Button>
                  ))}
                  <span className="text-sm text-gray-500">
                    entries
                  </span>
                </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    Selected: <strong>{selectedItems.length}</strong>
                  </span>
                </div>

                <div className="flex-1 flex flex-wrap gap-3 items-center">
                <Select value={selectedTeamLeader} onValueChange={setSelectedTeamLeader}>
                    <SelectTrigger className="w-[300px] max-w-full h-11 min-w-0 overflow-hidden text-base font-medium justify-start gap-3">
                      <UserCog className="w-4 h-4 mr-2" />
                      <SelectValue className="min-w-0 flex-1 truncate text-left" placeholder="Select Director or Sales Manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {directorsAndSalesManagers.map(target => (
                        <SelectItem key={target.id} value={target.id.toString()}>
                          {target.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button 
                    variant="outline" 
                    onClick={handleAssignTeamLeader} 
                    disabled={selectedItems.length === 0 || !selectedTeamLeader}
                    className="h-11 w-[320px] max-w-full whitespace-nowrap"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Assign to Director / Sales Manager
                  </Button>
                </div>

                <Select value={filterAssignedTeamLeader} onValueChange={setFilterAssignedTeamLeader}>
                  <SelectTrigger className="w-[300px] max-w-full h-11 min-w-0 overflow-hidden text-base font-medium justify-start gap-3">
                    <UserCog className="w-4 h-4 mr-2" />
                    <SelectValue className="min-w-0 flex-1 truncate text-left" placeholder="Filter by Director / Sales Manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Directors / Sales Managers</SelectItem>
                    {directorsAndSalesManagers.map(target => (
                      <SelectItem key={target.id} value={target.id.toString()}>
                        {target.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-[200px]"
                  />
                </div>
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
                          checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                          onCheckedChange={toggleAllSelection}
                        />
                      </TableHead>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Current Assignee</TableHead>
                      <TableHead>Team Leader</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPageItems.map((call) => (
                      <TableRow key={call.id}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedItems.includes(call.id)}
                            onCheckedChange={() => toggleItemSelection(call.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{call.id}</TableCell>
                        <TableCell>{call.name}</TableCell>
                        <TableCell>{call.phone}</TableCell>
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
                        <TableCell>
                          <Select
                            value={call.projectId ? call.projectId.toString() : ''}
                            onValueChange={(value) => handleProjectAssign(call.id, value, 'coldcalls')}
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
                        <TableCell>{call.assignedTo || '-'}</TableCell>
                        <TableCell>{call.teamLeader || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-t">
                <p className="text-sm text-gray-500">
                  Showing {(safeCurrentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(safeCurrentPage * pageSize, filteredItems.length)} of {filteredItems.length} entries
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={safeCurrentPage === 1}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={safeCurrentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
