import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, PhoneCall, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/contexts/DataContext';
import { apiFetch, errorMessage, readApiError } from '@/lib/api';
import { isSuperRole } from '@/lib/roles';
import { budgetText, choiceLabel, formatMoney } from '@/lib/requirements';
import type { CallRecord, Lead } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ActivityTimeline } from '@/components/calls/ActivityTimeline';
import { CallActionDialog, type CallTarget } from '@/components/calls/CallActionDialog';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { EditCallDialog } from '@/components/calls/EditCallDialog';
import { ContactButtons } from '@/components/records/ContactButtons';

const when = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

/** One lead: contact info, requirements, Call History and the activity timeline. Read fresh from the server. */
export default function LeadDetails() {
  const { id } = useParams<{ id: string }>();
  const leadId = Number(id);
  const { user } = useAuth();
  const { leadOptions, statuses } = useData();
  const [lead, setLead] = useState<Lead | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [callTarget, setCallTarget] = useState<CallTarget | null>(null);
  const [editing, setEditing] = useState<CallRecord | null>(null);
  const [editLead, setEditLead] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadRes, callsRes] = await Promise.all([apiFetch(`leads/${leadId}`), apiFetch(`call-actions?leadId=${leadId}`)]);
      if (!leadRes.ok) throw await readApiError(leadRes);
      if (!callsRes.ok) throw await readApiError(callsRes);
      setLead((await leadRes.json()) as Lead);
      setCalls((await callsRes.json()) as CallRecord[]);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load, refresh]);

  if (!Number.isInteger(leadId) || leadId <= 0) return <p className="text-gray-500">Invalid lead.</p>;
  if (!lead) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline"><Link to="/leads"><ArrowLeft className="mr-2 h-4 w-4" /> Back to leads</Link></Button>
        {error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span className="flex-1">Could not load this lead: {error}</span>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Retry</Button>
          </div>
        ) : (
          <p className="text-gray-500">Loading lead...</p>
        )}
      </div>
    );
  }

  const req = lead.requirements;
  const names = (ids: number[] | undefined, list: { id: number; name: string }[]) => (ids ?? []).map((x) => list.find((o) => o.id === x)?.name ?? `#${x}`).join(', ');
  const status = statuses.find((s) => s.id === lead.statusId);
  const openCall = () => setCallTarget({ type: 'lead', id: lead.id, name: lead.name, phone: lead.phone, whatsapp: lead.whatsapp, statusId: lead.statusId });
  const info: [string, React.ReactNode][] = [
    ['Phone', <span dir="ltr">{lead.phone}</span>], ['WhatsApp', lead.whatsapp || '-'], ['Email', lead.email || '-'], ['Source', lead.source || '-'],
    ['Project', lead.project || '-'], ['Assigned to', lead.assignedTo || '-'], ['Team leader', lead.teamLeader || '-'], ['Added', lead.date || '-'],
  ];
  const requirements: [string, string][] = [
    ['Destinations', names(req?.destinationIds, leadOptions.destinations) || '-'], ['Property types', names(req?.propertyTypeIds, leadOptions.propertyTypes) || '-'],
    ['Budget', budgetText(req) || '-'], ['Delivery', choiceLabel(leadOptions.delivery, req?.delivery) || '-'],
    ['Finishing', choiceLabel(leadOptions.finishing, req?.finishing) || '-'], ['Purpose of purchase', choiceLabel(leadOptions.purpose, req?.purpose) || '-'],
    ['Down payment', formatMoney(req?.downPayment) || '-'], ['Installment / quarter', formatMoney(req?.installmentPerQuarter) || '-'],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="icon" aria-label="Back to leads"><Link to="/leads"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
        <Badge style={{ backgroundColor: status?.color ?? '#6B7280', color: 'white' }}>{lead.status || 'No status'}</Badge>
        <div className="ml-auto flex gap-2">
          <ContactButtons phone={lead.phone} whatsapp={lead.whatsapp} name={lead.name} onCall={openCall} />
          <Button variant="outline" onClick={() => setEditLead(true)}><Pencil className="mr-2 h-4 w-4" /> Edit lead</Button>
          <Button onClick={openCall}><PhoneCall className="mr-2 h-4 w-4" /> Log call</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Contact</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
              {info.map(([k, v]) => <div key={k} className="contents"><dt className="text-gray-500">{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Client requirements</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-sm" data-testid="lead-requirements">
              {requirements.map(([k, v]) => <div key={k} className="contents"><dt className="text-gray-500">{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Call History ({calls.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table data-testid="lead-call-history">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Logged by</TableHead><TableHead>Outcome</TableHead><TableHead>Notes</TableHead><TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-gray-500">No calls yet - use "Log call".</TableCell></TableRow>}
                {calls.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">{when(c.callAt)}</TableCell>
                    <TableCell>{c.userName}</TableCell>
                    <TableCell>{c.outcomeLabel || '-'}</TableCell>
                    <TableCell className="max-w-[260px] whitespace-pre-wrap">{c.notes || '-'}</TableCell>
                    <TableCell>
                      {(isSuperRole(user?.role) || c.userId === user?.id) && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit call ${c.id}`} onClick={() => setEditing(c)}><Pencil className="h-4 w-4 text-green-600" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Activity timeline</CardTitle></CardHeader>
        <CardContent><ActivityTimeline entityType="lead" entityId={lead.id} refreshKey={refresh} /></CardContent>
      </Card>

      <CallActionDialog target={callTarget} onOpenChange={(open) => !open && setCallTarget(null)} onSaved={() => setRefresh((n) => n + 1)} />
      <LeadFormDialog open={editLead} onOpenChange={setEditLead} leadId={lead.id} onSaved={() => setRefresh((n) => n + 1)} />
      <EditCallDialog call={editing} onClose={() => setEditing(null)} onSaved={() => setRefresh((n) => n + 1)} />
    </div>
  );
}
