import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { DataProvider } from '@/contexts/DataContext';
import { Toaster } from '@/components/ui/sonner';

// Pages
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Developers from '@/pages/Developers';
import DeveloperDetails from '@/pages/DeveloperDetails';
import Deals from '@/pages/Deals';
import Leads from '@/pages/Leads';
import ColdCalls from '@/pages/ColdCalls';
import Reports from '@/pages/Reports';
import AgentCare from '@/pages/AgentCare';
import Profile from '@/pages/Profile';

// Admin Pages
import AdminUsers from '@/pages/admin/Users';
import AdminDepartments from '@/pages/admin/Departments';
import AdminJobTitles from '@/pages/admin/JobTitles';
import AdminBrokers from '@/pages/admin/Brokers';
import AdminTitles from '@/pages/admin/Titles';
import AdminStatuses from '@/pages/admin/Statuses';
import AdminSources from '@/pages/admin/Sources';
import AdminProjects from '@/pages/admin/Projects';
import AdminAssign from '@/pages/admin/Assign';
import AdminUploadData from '@/pages/admin/UploadData';

// Layout
import MainLayout from '@/components/layout/MainLayout';

function PrivateRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      
      <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="developers" element={<Developers />} />
        <Route path="developers/:id" element={<DeveloperDetails />} />
        <Route path="deals" element={<Deals />} />
        <Route path="leads" element={<Leads />} />
        <Route path="cold-calls" element={<ColdCalls />} />
        <Route path="reports" element={<Reports />} />
        <Route path="agent-care" element={<AgentCare />} />
        <Route path="profile" element={<Profile />} />
        
        {/* Admin Routes */}
        <Route path="admin/users" element={<PrivateRoute allowedRoles={['admin', 'franchise_owner']}><AdminUsers /></PrivateRoute>} />
        <Route path="admin/departments" element={<PrivateRoute allowedRoles={['admin', 'franchise_owner']}><AdminDepartments /></PrivateRoute>} />
        <Route path="admin/jobtitles" element={<PrivateRoute allowedRoles={['admin', 'franchise_owner']}><AdminJobTitles /></PrivateRoute>} />
        <Route path="admin/brokers" element={<PrivateRoute allowedRoles={['admin', 'franchise_owner']}><AdminBrokers /></PrivateRoute>} />
        <Route path="admin/titles" element={<PrivateRoute allowedRoles={['admin', 'franchise_owner']}><AdminTitles /></PrivateRoute>} />
        <Route path="admin/statuses" element={<PrivateRoute allowedRoles={['admin', 'franchise_owner']}><AdminStatuses /></PrivateRoute>} />
        <Route path="admin/sources" element={<PrivateRoute allowedRoles={['admin', 'franchise_owner']}><AdminSources /></PrivateRoute>} />
        <Route path="admin/projects" element={<PrivateRoute allowedRoles={['admin', 'franchise_owner']}><AdminProjects /></PrivateRoute>} />
        <Route path="admin/assign" element={<PrivateRoute allowedRoles={['admin', 'franchise_owner', 'team_leader']}><AdminAssign /></PrivateRoute>} />
        <Route path="admin/upload-data" element={<PrivateRoute allowedRoles={['admin', 'franchise_owner']}><AdminUploadData /></PrivateRoute>} />
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <DataProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
          <Toaster position="top-right" />
        </Router>
      </AuthProvider>
    </DataProvider>
  );
}

export default App;
