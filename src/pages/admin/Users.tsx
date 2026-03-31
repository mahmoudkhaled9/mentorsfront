import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import {
  Plus, 
  Search, 
  Copy,
  FileSpreadsheet,
  File as FileIcon,
  Columns,
  Trash2,
  Edit,
  Mail,
  Phone,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import { jsonRequest } from '@/lib/mutations';

export default function AdminUsers() {
  const { users, setUsers, titles, leads, coldCalls, deals } = useData();
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [showEntries, setShowEntries] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<(typeof users)[0] | null>(null);
  const [performanceUser, setPerformanceUser] = useState<(typeof users)[0] | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'team_leader' | 'agent' | 'sales_manager' | 'sales_supervisor' | 'director' | 'franchise_owner' | ''>('');
  const [newUserTitle, setNewUserTitle] = useState('');
  const [newUserTeamLeader, setNewUserTeamLeader] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const canViewPerformance = currentUser?.role === 'admin' || currentUser?.role === 'franchise_owner';

  // Filter users
  const filteredUsers = users.filter(user => {
    return (
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone.includes(searchTerm) ||
      user.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / showEntries);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * showEntries,
    currentPage * showEntries
  );

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleAllSelection = () => {
    if (selectedUsers.length === paginatedUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(paginatedUsers.map(user => user.id));
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-500">Admin</Badge>;
      case 'franchise_owner':
        return <Badge className="bg-indigo-600">Franchise Owner</Badge>;
      case 'team_leader':
        return <Badge className="bg-blue-500">Team Leader</Badge>;
      case 'sales_manager':
        return <Badge className="bg-amber-500">Sales Manager</Badge>;
      case 'sales_supervisor':
        return <Badge className="bg-teal-500">Sales Supervisor</Badge>;
      case 'director':
        return <Badge className="bg-rose-500">Director</Badge>;
      case 'agent':
        return <Badge className="bg-green-500">Agent</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const teamLeaders = users.filter(u => u.role === 'team_leader');
  const salesManagers = users.filter(u => u.role === 'sales_manager');
  const directors = users.filter(u => u.role === 'director');

  const parentSelectLabel = (() => {
    if (newUserRole === 'agent') return 'Assign to Team Leader';
    if (newUserRole === 'team_leader') return 'Assign to Sales Manager';
    if (newUserRole === 'sales_supervisor') return 'Assign to Director';
    if (newUserRole === 'sales_manager') return 'Assign to Director';
    return '';
  })();

  const parentOptions = (() => {
    if (newUserRole === 'agent') return teamLeaders;
    if (newUserRole === 'team_leader') return salesManagers;
    if (newUserRole === 'sales_supervisor') return directors;
    if (newUserRole === 'sales_manager') return directors;
    return [];
  })();

  const resetForm = () => {
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPhone('');
    setNewUserRole('');
    setNewUserTitle('');
    setNewUserTeamLeader('');
    setNewUserPassword('');
  };

  const handleAddUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPhone.trim() || !newUserRole || !newUserPassword.trim()) {
      toast.error('Please fill in name, email, phone, role, and password');
      return;
    }

    try {
      const created = await jsonRequest<{ ok: boolean; id?: number }>('users', {
        method: 'POST',
        body: {
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          phone: newUserPhone.trim(),
          role: newUserRole,
          password: newUserPassword.trim(),
          title: newUserTitle || undefined,
          department: 'Sales',
          teamLeaderId: newUserTeamLeader ? Number(newUserTeamLeader) : undefined,
          isActive: true,
        },
      });
      const nextId = created.id ?? (users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1);
      setUsers(prev => [
        ...prev,
        {
          id: nextId,
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          phone: newUserPhone.trim(),
          role: newUserRole,
          password: newUserPassword.trim(),
          title: newUserTitle || undefined,
          department: 'Sales',
          teamLeaderId: newUserTeamLeader ? Number(newUserTeamLeader) : undefined,
          isActive: true,
          createdAt: new Date().toISOString().split('T')[0],
        },
      ]);
      toast.success('User added successfully!');
      setShowAddDialog(false);
      resetForm();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleEditUser = (user: (typeof users)[0]) => {
    setEditingUser(user);
    setNewUserName(user.name);
    setNewUserEmail(user.email);
    setNewUserPhone(user.phone);
    setNewUserRole(user.role);
    setNewUserTitle(user.title || '');
    setNewUserTeamLeader(user.teamLeaderId ? user.teamLeaderId.toString() : '');
    setNewUserPassword('');
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    try {
      await jsonRequest(`users/${editingUser.id}`, {
        method: 'PUT',
        body: {
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          phone: newUserPhone.trim(),
          role: newUserRole,
          title: newUserTitle || undefined,
          teamLeaderId: newUserTeamLeader ? Number(newUserTeamLeader) : undefined,
          password: newUserPassword.trim() || undefined,
        },
      });

      setUsers(prev =>
        prev.map(u =>
          u.id === editingUser.id
            ? {
                ...u,
                name: newUserName.trim(),
                email: newUserEmail.trim(),
                phone: newUserPhone.trim(),
                role: newUserRole as 'admin' | 'team_leader' | 'agent' | 'sales_manager' | 'sales_supervisor' | 'director' | 'franchise_owner',
                title: newUserTitle || undefined,
                teamLeaderId: newUserTeamLeader ? Number(newUserTeamLeader) : undefined,
                password: newUserPassword.trim() ? newUserPassword.trim() : u.password,
              }
            : u
        )
      );

      toast.success('User updated successfully!');
      setEditingUser(null);
      resetForm();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await jsonRequest(`users/${userId}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('User deleted successfully!');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedUsers.length === 0) return;
    try {
      await Promise.all(selectedUsers.map((userId) => jsonRequest(`users/${userId}`, { method: 'DELETE' })));
      setUsers(prev => prev.filter(u => !selectedUsers.includes(u.id)));
      toast.success(`Deleted ${selectedUsers.length} users`);
      setSelectedUsers([]);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const getPerformanceStats = (userId: number) => {
    const userLeads = leads.filter(lead => lead.assignedToId === userId);
    const userCalls = coldCalls.filter(call => call.assignedToId === userId);
    const userDeals = deals.filter(deal => deal.agentId === userId);
    const meetingCount =
      [...userLeads, ...userCalls].filter(item =>
        item.status.toLowerCase().includes('meeting')
      ).length;

    return {
      leads: userLeads.length,
      coldCalls: userCalls.length,
      deals: userDeals.length,
      meetings: meetingCount,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">User List</h1>
          <Badge variant="secondary" className="text-lg">
            {filteredUsers.length}
          </Badge>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add user
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input placeholder="Full Name" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
              <Input placeholder="Email" type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
              <Input placeholder="Phone" value={newUserPhone} onChange={(e) => setNewUserPhone(e.target.value)} />
              <Input
                placeholder="Password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
              <Select
                value={newUserRole}
                onValueChange={(value) => {
                  setNewUserRole(value as 'admin' | 'team_leader' | 'agent' | 'sales_manager' | 'sales_supervisor' | 'director' | 'franchise_owner');
                  setNewUserTeamLeader('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="franchise_owner">Franchise Owner</SelectItem>
                  <SelectItem value="director">Director</SelectItem>
                  <SelectItem value="sales_manager">Sales Manager</SelectItem>
                  <SelectItem value="sales_supervisor">Sales Supervisor</SelectItem>
                  <SelectItem value="team_leader">Team Leader</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newUserTitle} onValueChange={setNewUserTitle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Title" />
                </SelectTrigger>
                <SelectContent>
                  {titles.map(title => (
                    <SelectItem key={title.id} value={title.name}>
                      {title.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {parentSelectLabel && (
                <Select value={newUserTeamLeader} onValueChange={setNewUserTeamLeader}>
                  <SelectTrigger>
                    <SelectValue placeholder={parentSelectLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    {parentOptions.map(parent => (
                      <SelectItem key={parent.id} value={parent.id.toString()}>
                        {parent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={handleAddUser}>
                Add User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
              <Button variant="outline" size="sm" onClick={() => toast.success('Exported to Excel!')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.success('Exported to PDF!')}>
                <FileIcon className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.success('Column settings opened')}>
                <Columns className="w-4 h-4 mr-2" />
                Columns
              </Button>
              {selectedUsers.length > 0 && (
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

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
                      onCheckedChange={toggleAllSelection}
                    />
                  </TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={() => toggleUserSelection(user.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{user.id}</TableCell>
                    <TableCell>
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-gray-200 text-gray-600">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {user.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-gray-400" />
                        {user.department}
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>{user.title || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {canViewPerformance && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => setPerformanceUser(user)}
                          >
                            View Performance
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditUser(user)}>
                          <Edit className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteUser(user.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-gray-500">
              Showing {(currentPage - 1) * showEntries + 1} to{' '}
              {Math.min(currentPage * showEntries, filteredUsers.length)} of{' '}
              {filteredUsers.length} entries
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
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
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Full Name" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
            <Input placeholder="Email" type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
            <Input placeholder="Phone" value={newUserPhone} onChange={(e) => setNewUserPhone(e.target.value)} />
            <Input
              placeholder="New Password (leave blank to keep)"
              type="password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
            />
            <Select
              value={newUserRole}
              onValueChange={(value) => {
                setNewUserRole(value as 'admin' | 'team_leader' | 'agent' | 'sales_manager' | 'sales_supervisor' | 'director' | 'franchise_owner');
                setNewUserTeamLeader('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="franchise_owner">Franchise Owner</SelectItem>
                <SelectItem value="director">Director</SelectItem>
                <SelectItem value="sales_manager">Sales Manager</SelectItem>
                <SelectItem value="sales_supervisor">Sales Supervisor</SelectItem>
                <SelectItem value="team_leader">Team Leader</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newUserTitle} onValueChange={setNewUserTitle}>
              <SelectTrigger>
                <SelectValue placeholder="Select Title" />
              </SelectTrigger>
              <SelectContent>
                {titles.map(title => (
                  <SelectItem key={title.id} value={title.name}>
                    {title.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {parentSelectLabel && (
              <Select value={newUserTeamLeader} onValueChange={setNewUserTeamLeader}>
                <SelectTrigger>
                  <SelectValue placeholder={parentSelectLabel} />
                </SelectTrigger>
                <SelectContent>
                  {parentOptions.map(parent => (
                    <SelectItem key={parent.id} value={parent.id.toString()}>
                      {parent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!performanceUser} onOpenChange={() => setPerformanceUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {performanceUser ? `Performance - ${performanceUser.name}` : 'Performance'}
            </DialogTitle>
          </DialogHeader>
          {performanceUser && (() => {
            const stats = getPerformanceStats(performanceUser.id);
            return (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-gray-50">
                  <p className="text-xs text-gray-500">Meetings</p>
                  <p className="text-xl font-semibold text-gray-900">{stats.meetings}</p>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50">
                  <p className="text-xs text-gray-500">Deals</p>
                  <p className="text-xl font-semibold text-gray-900">{stats.deals}</p>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50">
                  <p className="text-xs text-gray-500">Cold Calls</p>
                  <p className="text-xl font-semibold text-gray-900">{stats.coldCalls}</p>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50">
                  <p className="text-xs text-gray-500">Leads</p>
                  <p className="text-xl font-semibold text-gray-900">{stats.leads}</p>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
