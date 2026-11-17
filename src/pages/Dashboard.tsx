import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getVisibleUserIds } from '@/lib/hierarchy';
import {
  Users,
  PhoneCall,
  Handshake,
  Banknote,
  UserPlus,
  Target,
  CheckCircle,
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
}

function StatCard({ title, value, icon: Icon, trend, trendUp }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {trend && (
              <p className={`text-sm mt-1 ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
                {trend}
              </p>
            )}
          </div>
          <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg">
            <Icon className="w-6 h-6 text-gray-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { leads, coldCalls, deals, users } = useData();

  const visibleUserIds = getVisibleUserIds(user, users);
  const scopedLeads = leads.filter(lead => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'franchise_owner') return true;
    const assignedVisible = lead.assignedToId && visibleUserIds.includes(lead.assignedToId);
    const teamLeaderVisible = lead.teamLeaderId && visibleUserIds.includes(lead.teamLeaderId);
    return assignedVisible || teamLeaderVisible;
  });
  const scopedColdCalls = coldCalls.filter(call => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'franchise_owner') return true;
    const assignedVisible = call.assignedToId && visibleUserIds.includes(call.assignedToId);
    const teamLeaderVisible = call.teamLeaderId && visibleUserIds.includes(call.teamLeaderId);
    return assignedVisible || teamLeaderVisible;
  });
  const scopedDeals = deals.filter(deal => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'franchise_owner') return true;
    return visibleUserIds.includes(deal.agentId);
  });

  const totalCommission = scopedDeals.reduce((sum, deal) => sum + deal.commission, 0);
  const totalDeals = scopedDeals.length;
  const totalLeads = scopedLeads.length;
  const totalColdCalls = scopedColdCalls.length;
  const newLeads = scopedLeads.filter((lead) => lead.status === 'New Lead').length;
  const potentialLeads = scopedLeads.filter((lead) => lead.isPotential).length;
  const closedDeals = scopedDeals.filter((deal) => deal.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-gray-500 mt-1">
          Here's what's happening in your CRM today
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Leads"
          value={totalLeads.toLocaleString()}
          icon={Users}
          trend="+12% from last month"
          trendUp={true}
        />
        <StatCard
          title="Cold Calls"
          value={totalColdCalls.toLocaleString()}
          icon={PhoneCall}
          trend="+8% from last month"
          trendUp={true}
        />
        <StatCard
          title="Total Deals"
          value={totalDeals}
          icon={Handshake}
          trend="+25% from last month"
          trendUp={true}
        />
        <StatCard
          title="Total Commission"
          value={`${totalCommission.toLocaleString()} EGP`}
          icon={Banknote}
          trend="+15% from last month"
          trendUp={true}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">New Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold">{newLeads.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Potential Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold">{potentialLeads}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Closed Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-purple-500" />
              <span className="text-2xl font-bold">{closedDeals}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">New lead assigned</p>
                <p className="text-sm text-gray-500">Ahmed damrany was assigned to Ziad Hesham</p>
              </div>
              <span className="text-sm text-gray-400">2 hours ago</span>
            </div>

            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                <Handshake className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Deal closed</p>
                <p className="text-sm text-gray-500">Mahmoud El Kashouty closed a deal for 15M EGP</p>
              </div>
              <span className="text-sm text-gray-400">5 hours ago</span>
            </div>

            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center w-10 h-10 bg-orange-100 rounded-full">
                <PhoneCall className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Call back scheduled</p>
                <p className="text-sm text-gray-500">Ahmed Gaber scheduled a call back for tomorrow</p>
              </div>
              <span className="text-sm text-gray-400">1 day ago</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
