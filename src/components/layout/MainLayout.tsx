import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Building2,
  Handshake,
  Users,
  PhoneCall,
  FileText,
  HeadphonesIcon,
  Settings,
  Menu,
  LogOut,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Briefcase,
  UserCog,
  Tag,
  Globe,
  FolderOpen,
  UserPlus,
  Upload,
  UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import mentorsBanner from '@/assets/mentors-banner.jpg';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles?: string[];
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Developers', path: '/developers', icon: Building2 },
  { label: 'Deals', path: '/deals', icon: Handshake },
  { label: 'Leads', path: '/leads', icon: Users },
  { label: 'Cold Calls', path: '/cold-calls', icon: PhoneCall },
  { label: 'Reports', path: '/reports', icon: FileText },
  { label: 'Agent Care', path: '/agent-care', icon: HeadphonesIcon },
  { label: 'Profile', path: '/profile', icon: UserCircle },
];

const adminNavItems: NavItem[] = [
  {
    label: 'Admin',
    path: '/admin',
    icon: Settings,
    roles: ['admin', 'team_leader', 'franchise_owner'],
    children: [
      { label: 'Users', path: '/admin/users', icon: UserCog },
      { label: 'Departments', path: '/admin/departments', icon: Briefcase },
      { label: 'Job Titles', path: '/admin/jobtitles', icon: Briefcase },
      { label: 'Brokers', path: '/admin/brokers', icon: Briefcase },
      { label: 'Titles', path: '/admin/titles', icon: Briefcase },
      { label: 'Statuses', path: '/admin/statuses', icon: Tag },
      { label: 'Sources', path: '/admin/sources', icon: Globe },
      { label: 'Projects', path: '/admin/projects', icon: FolderOpen },
      { label: 'Assign', path: '/admin/assign', icon: UserPlus },
      { label: 'Upload Data', path: '/admin/upload-data', icon: Upload, roles: ['admin', 'franchise_owner'] },
    ],
  },
];

function SidebarItem({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (item.roles && user && !item.roles.includes(user.role)) {
    return null;
  }

  const hasChildren = item.children && item.children.length > 0;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex items-center w-full gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg',
            'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            depth > 0 && 'pl-8'
          )}
        >
          <item.icon className="w-5 h-5" />
          <span className="flex-1 text-left">{item.label}</span>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {isOpen && (
          <div className="mt-1 space-y-1">
            {item.children?.map((child) => (
              <SidebarItem key={child.path} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg',
          isActive
            ? 'bg-black text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          depth > 0 && 'pl-8'
        )
      }
    >
      <item.icon className="w-5 h-5" />
      <span>{item.label}</span>
    </NavLink>
  );
}

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-64">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
        <img
          src={mentorsBanner}
          alt="Mentors"
          className="w-10 h-10 rounded-lg object-cover"
        />
        <div>
          <h1 className="text-lg font-bold text-gray-900">Mentors</h1>
          <p className="text-xs text-gray-500">CRM System</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase">Main Menu</p>
        {navItems.map((item) => (
          <SidebarItem key={item.path} item={item} />
        ))}

        {adminNavItems.map((item) => (
          <SidebarItem key={item.path} item={item} />
        ))}
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user?.avatar || undefined} alt={user?.name ?? 'User'} />
            <AvatarFallback>
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}

function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="w-6 h-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation menu</SheetTitle>
          <SheetDescription>Primary navigation for the Mentors CRM.</SheetDescription>
        </SheetHeader>
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
}

export default function MainLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <div className="flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-200 lg:hidden">
          <MobileSidebar />
          <div className="flex items-center gap-2">
            <img
              src={mentorsBanner}
              alt="Mentors"
              className="w-8 h-8 rounded-lg object-cover"
            />
            <span className="font-bold text-gray-900">Mentors</span>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
