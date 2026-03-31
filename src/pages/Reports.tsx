import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { getVisibleUserIds } from '@/lib/hierarchy';
import {
  FileText,
  Search,
  User,
  Calendar,
  MessageSquare,
  Plus,
  Edit,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { jsonRequest } from '@/lib/mutations';
import type { Report, Lead } from '@/types';

type ReportTarget = {
  name: string;
  phone: string;
  typeLabel: string;
};

export default function Reports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [newCommentContent, setNewCommentContent] = useState('');
  const [selectedCommentTarget, setSelectedCommentTarget] = useState('');
  const { user } = useAuth();
  const { reports, setReports, leads, coldCalls, users } = useData();

  const visibleUserIds = getVisibleUserIds(user, users);
  const visibleReports = reports.filter((report) => {
    if (!user) return true;
    if (user.role === 'admin' || user.role === 'franchise_owner') return true;
    const ownerId = Number(report.agentId ?? report.createdById ?? 0);
    return visibleUserIds.includes(ownerId);
  });

  const resolveReportTarget = (report: Report | null | undefined): ReportTarget => {
    if (!report) {
      return { name: 'Unknown', phone: '-', typeLabel: 'Client' };
    }
    return {
      name: report.clientName || 'Unknown',
      phone: report.clientPhone || '-',
      typeLabel: report.entityType === 'cold_call' ? 'Cold Call' : 'Lead',
    };
  };

  const filteredReports = visibleReports.filter((report) => {
    const target = resolveReportTarget(report);
    const creatorName = report.createdBy || report.agentName || '';
    const teamLeaderName = report.teamLeaderName || '';
    return (
      report.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      creatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      target.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      target.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teamLeaderName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getTeamLeaderName = (agentId?: number | null) => {
    const agent = users.find((item) => item.id === Number(agentId ?? 0));
    if (agent?.teamLeaderId) {
      const tl = users.find((item) => item.id === agent.teamLeaderId);
      return tl?.name || '-';
    }
    return '-';
  };

  const getLeadLikeTarget = (entityType: 'lead' | 'cold_call', id: number): Lead | undefined => {
    if (entityType === 'lead') {
      return leads.find((item) => item.id === id);
    }
    return coldCalls.find((item) => item.id === id);
  };

  const buildReportSnapshot = (entityType: 'lead' | 'cold_call', id: number, commentId: number, content: string): Report => {
    const target = getLeadLikeTarget(entityType, id);
    const currentUserId = Number(user?.id ?? 0);
    const teamLeader = user?.teamLeaderId ? users.find((item) => item.id === user.teamLeaderId) : undefined;
    return {
      id: commentId,
      commentId,
      leadId: entityType === 'lead' ? id : null,
      coldCallId: entityType === 'cold_call' ? id : null,
      entityType,
      entityId: id,
      clientName: target?.name || 'Unknown',
      clientPhone: target?.phone || '',
      agentId: currentUserId || null,
      agentName: user?.name || 'Unknown',
      teamLeaderId: teamLeader?.id ?? null,
      teamLeaderName: teamLeader?.name || '',
      statusId: target?.statusId ?? null,
      statusName: target?.status || '',
      projectId: target?.projectId ?? null,
      projectName: target?.project || '',
      developerId: null,
      developerName: '',
      content,
      createdBy: user?.name || 'Unknown',
      createdById: currentUserId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const handleEdit = (report: Report) => {
    setEditingComment(report.commentId);
    setEditContent(report.content);
  };

  const handleSaveEdit = async () => {
    if (!editingComment) return;
    try {
      await jsonRequest(`comments/${editingComment}`, {
        method: 'PUT',
        body: { content: editContent },
      });
      setReports((prev) =>
        prev.map((report) =>
          report.commentId === editingComment
            ? { ...report, content: editContent, updatedAt: new Date().toISOString() }
            : report
        )
      );
      toast.success('Comment updated successfully!');
      setEditingComment(null);
      setEditContent('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async (commentId: number) => {
    try {
      await jsonRequest(`comments/${commentId}`, { method: 'DELETE' });
      setReports((prev) => prev.filter((report) => report.commentId !== commentId));
      toast.success('Comment deleted successfully!');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleAddComment = async () => {
    if (!newCommentContent.trim() || !selectedCommentTarget) {
      toast.error('Select a lead and enter a comment');
      return;
    }
    const [entityTypeRaw, rawId] = selectedCommentTarget.split(':');
    const entityType = entityTypeRaw as 'lead' | 'cold_call';
    const selectedId = Number(rawId);
    if (!entityType || !selectedId) {
      toast.error('Select a lead or cold call and enter a comment');
      return;
    }
    try {
      const created = await jsonRequest<{ ok: boolean; id?: number }>('comments', {
        method: 'POST',
        body: {
          leadId: selectedId,
          entityType,
          entityId: selectedId,
          content: newCommentContent.trim(),
          createdBy: user?.name || 'Unknown',
          createdById: user?.id || 0,
        },
      });
      const commentId = created.id ?? (reports.length > 0 ? Math.max(...reports.map((item) => item.commentId)) + 1 : 1);
      const reportSnapshot = buildReportSnapshot(entityType, selectedId, commentId, newCommentContent.trim());
      setReports((prev) => [...prev, reportSnapshot]);
      toast.success('Comment added successfully!');
      setShowAddDialog(false);
      setNewCommentContent('');
      setSelectedCommentTarget('');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Comments</h1>
          <p className="text-gray-500 mt-1">
            View and manage all client comments and reports stored in MySQL
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Comment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Comment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-gray-500">
                Select a lead and add your comment. This will automatically appear in the reports database table.
              </p>
              <select
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                value={selectedCommentTarget}
                onChange={(e) => setSelectedCommentTarget(e.target.value)}
              >
                <option value="">Select Lead or Cold Call</option>
                {leads.map((lead) => (
                  <option key={`lead-${lead.id}`} value={`lead:${lead.id}`}>
                    {lead.name} ({lead.phone}) - Lead
                  </option>
                ))}
                {coldCalls.map((call) => (
                  <option key={`call-${call.id}`} value={`cold_call:${call.id}`}>
                    {call.name} ({call.phone}) - Cold Call
                  </option>
                ))}
              </select>
              <Input
                placeholder="Comment content"
                value={newCommentContent}
                onChange={(e) => setNewCommentContent(e.target.value)}
              />
              <Button onClick={handleAddComment}>Add Comment</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search comments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <div
                key={report.commentId}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                {editingComment === report.commentId ? (
                  <div className="space-y-3">
                    <Input
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingComment(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-gray-800">{report.content}</p>
                      </div>
                      <div className="flex gap-1 ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(report)}
                        >
                          <Edit className="w-4 h-4 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDelete(report.commentId)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>Agent: {report.agentName || report.createdBy}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{report.createdAt}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>
                          Client: {resolveReportTarget(report).name} ({resolveReportTarget(report).typeLabel})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Phone: {resolveReportTarget(report).phone}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Team Leader: {report.teamLeaderName || getTeamLeaderName(report.agentId ?? report.createdById)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {filteredReports.length === 0 && (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No reports found</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-black border-black text-white">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">How Reports Work</h3>
              <p className="text-sm text-gray-300 mt-1">
                When an agent types a comment on a client, it is now saved in the MySQL reports table and shown here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
