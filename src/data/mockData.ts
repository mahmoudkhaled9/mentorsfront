import type { 
  User, Title, Developer, Project, Status, LeadSource, 
  Lead, Comment, Deal, AgentCare, DashboardStats, Report
} from '@/types';

// Users
export const users: User[] = [
  { id: 1, name: 'Admin User', email: 'admin@mentors.com', phone: '01000000000', role: 'admin', title: 'System Admin', department: 'Admins', isActive: true, createdAt: '2024-01-01', password: 'password' },
];

// Titles
export const titles: Title[] = [
  { id: 1, name: 'Property Advisor', department: 'Sales' },
  { id: 2, name: 'Property Consultant', department: 'Sales' },
  { id: 3, name: 'Senior Property', department: 'Sales' },
  { id: 4, name: 'Supervisor', department: 'Sales' },
  { id: 5, name: 'Associate Manager', department: 'Sales' },
  { id: 6, name: 'Senior Manager', department: 'Sales' },
  { id: 7, name: 'Associate Director', department: 'Sales' },
  { id: 8, name: 'Senior Director', department: 'Sales' },
  { id: 9, name: 'Branch Director', department: 'Sales' },
  { id: 10, name: 'Head Of Sales', department: 'Sales' },
];

// Developers
export const developers: Developer[] = [
  { 
    id: 1, 
    name: 'Ora', 
    logo: '/developers/ahly-sabbour.jpg',
    description: 'Ora is a developer with an ethos to deliver unmatched experiences that embody human aspirations of self-fulfillment, and the pinnacle of happiness through a sensorial approach that can only be described as a surreal yet perfect moment of lifetime in luxury living.',
    phone: '01021128292',
    whatsapp: '01021128292',
    email: 'info@oradevelopers.com',
    website: 'https://www.ora-egypt.com/residential',
    establishedYear: 2016,
    foundedBy: 'Naguib Sawiris',
    lastUpdated: '1 month ago'
  },
  { 
    id: 2, 
    name: 'Hassan Allam Properties', 
    logo: '/developers/tatweer-misr.jpg',
    description: 'Hassan Allam Properties is one of Egypt\'s leading real estate developers, known for delivering high-quality residential and commercial projects.',
    phone: '01012345678',
    whatsapp: '01012345678',
    email: 'info@hassanallam.com',
    website: 'https://www.hassanallam.com',
    lastUpdated: '1 month ago'
  },
  { 
    id: 3, 
    name: 'Hyde Park Developments', 
    logo: '/developers/horizon.jpg',
    description: 'Hyde Park Developments creates vibrant communities that offer a unique lifestyle experience with world-class amenities.',
    phone: '01087654321',
    whatsapp: '01087654321',
    email: 'info@hydepark.com',
    website: 'https://www.hydepark.com',
    lastUpdated: '6 months ago'
  },
  { 
    id: 4, 
    name: 'Tatweer Misr', 
    logo: '/developers/hassan-allam.jpg',
    description: 'Tatweer Misr is a leading real estate developer in Egypt, creating innovative and sustainable communities.',
    phone: '01011223344',
    whatsapp: '01011223344',
    email: 'info@tatweermisr.com',
    website: 'https://www.tatweermisr.com',
    lastUpdated: '6 months ago'
  },
  { 
    id: 5, 
    name: 'Mountain View', 
    logo: '/developers/ora.jpg',
    description: 'Mountain View develops premium residential compounds with stunning landscapes and modern designs.',
    phone: '01055667788',
    whatsapp: '01055667788',
    email: 'info@mountainview.com',
    website: 'https://www.mountainview.com',
    lastUpdated: '6 months ago'
  },
  { 
    id: 6, 
    name: 'Horizon Egypt', 
    logo: '/developers/hyde-park.jpg',
    description: 'Horizon Egypt Developments creates exceptional living spaces with a focus on quality and innovation.',
    phone: '01099887766',
    whatsapp: '01099887766',
    email: 'info@horizonegypt.com',
    website: 'https://www.horizonegypt.com',
    lastUpdated: '6 months ago'
  },
  { 
    id: 7, 
    name: 'AL-Marasem', 
    logo: '/developers/ahly-sabbour.jpg',
    description: 'AL-Marasem Development delivers premium residential projects with attention to detail and quality.',
    phone: '01033445566',
    whatsapp: '01033445566',
    email: 'info@almarasem.com',
    website: 'https://www.almarasem.com',
    lastUpdated: '6 months ago'
  },
  { 
    id: 8, 
    name: 'Al Ahly Sabbour', 
    logo: '/developers/almarassem.jpg',
    description: 'Al Ahly Sabbour Developments is a partnership between Al Ahly Capital and Sabbour Associates.',
    phone: '01077889900',
    whatsapp: '01077889900',
    email: 'info@alahlysabbour.com',
    website: 'https://www.alahlysabbour.com',
    lastUpdated: '6 months ago'
  },
];

// Projects
export const projects: Project[] = [
  { id: 1, name: 'SilverSands', developerId: 1, developerName: 'Ora', location: 'North Coast', startingPrice: 9000000, downPayment: '0% over 10 years' },
  { id: 2, name: 'La Vista NorthCoast', developerId: 3, developerName: 'Hyde Park Developments', location: 'North Coast' },
  { id: 3, name: 'La Vista New Cairo', developerId: 3, developerName: 'Hyde Park Developments', location: 'New Cairo' },
  { id: 4, name: 'Salt', developerId: 4, developerName: 'Tatweer Misr', location: 'North Coast' },
  { id: 5, name: 'Fouka Bay', developerId: 4, developerName: 'Tatweer Misr', location: 'North Coast' },
  { id: 6, name: 'D - Bay', developerId: 4, developerName: 'Tatweer Misr', location: 'North Coast' },
  { id: 7, name: 'Tatweer NorthCoast General', developerId: 4, developerName: 'Tatweer Misr', location: 'North Coast' },
  { id: 8, name: 'Haptown', developerId: 2, developerName: 'Hassan Allam Properties', location: 'New Cairo' },
  { id: 9, name: 'Cairo New Cairo', developerId: 2, developerName: 'Hassan Allam Properties', location: 'New Cairo' },
  { id: 10, name: 'Zed West', developerId: 1, developerName: 'Ora', location: 'Sheikh Zayed', startingPrice: 9000000, downPayment: '0% over 10 years', description: 'Serviced Apartments' },
];

// Statuses
export const statuses: Status[] = [
  { id: 1, name: 'New Lead', color: '#3B82F6' },
  { id: 2, name: 'No answer', color: '#6B7280' },
  { id: 3, name: 'Potential', color: '#22C55E' },
  { id: 4, name: 'Non potential', color: '#DC2626' },
  { id: 5, name: 'Call back', color: '#F97316' },
  { id: 6, name: 'Whatsapp', color: '#25D366' },
  { id: 7, name: 'Low budget', color: '#EA580C' },
  { id: 8, name: 'Hot case', color: '#EF4444' },
  { id: 9, name: 'Closed deal', color: '#16A34A' },
  { id: 10, name: 'Closed deal outside', color: '#9333EA' },
];

// Lead Sources
export const leadSources: LeadSource[] = [
  { id: 1, name: 'Meta', color: '#3B82F6' },
  { id: 2, name: 'Internal Database', color: '#22C55E' },
  { id: 3, name: 'Referral', color: '#F97316' },
  { id: 4, name: 'Website', color: '#8B5CF6' },
  { id: 5, name: 'Walk-in', color: '#EC4899' },
];

// Leads
export const leads: Lead[] = [];

// Cold Calls
export const coldCalls: Lead[] = [];

// Comments/Reports
export const comments: Comment[] = [];
export const reports: Report[] = [];

// Deals
export const deals: Deal[] = [];

// Agent Care
export const agentCare: AgentCare = {
  id: 1,
  name: 'Support Team',
  phone: '01100733207',
  whatsapp: '01100733207',
  email: 'support@Mentors.com'
};

// Dashboard Stats
export const dashboardStats: DashboardStats = {
  totalLeads: 0,
  totalColdCalls: 0,
  totalDeals: 0,
  totalCommission: 0,
  newLeads: 0,
  potentialLeads: 0,
  closedDeals: 0
};

// Helper function to calculate commission
export const calculateCommission = (amount: number): number => {
  // 5000 EGP for each million
  const millions = amount / 1000000;
  return Math.floor(millions * 5000);
};
