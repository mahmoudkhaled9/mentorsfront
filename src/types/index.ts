// User Types
export type UserRole =
  | 'admin'
  | 'agent'
  | 'team_leader'
  | 'sales_manager'
  | 'sales_supervisor'
  | 'director'
  | 'franchise_owner';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  title?: string;
  department?: string;
  departmentId?: number;
  jobtitleId?: number;
  teamLeaderId?: number;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  password?: string;
}

// Title Types
export interface Title {
  id: number;
  name: string;
  department: string;
}

// Developer Types
export interface Developer {
  id: number;
  name: string;
  logo: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  establishedYear?: number;
  foundedBy?: string;
  lastUpdated: string;
}

// Project Types
export interface Project {
  id: number;
  name: string;
  developerId: number;
  developerName?: string;
  destinationId?: number;
  destinationName?: string;
  location?: string;
  startingPrice?: number;
  downPayment?: string;
  description?: string;
}

// Status Types
export interface Status {
  id: number;
  name: string;
  color: string;
}

// Lead Source Types
export interface LeadSource {
  id: number;
  name: string;
  color: string;
}

// Lead Types
export type LeadType = 'Lead' | 'Coldcall';

export interface Lead {
  id: number;
  type: LeadType;
  name: string;
  phone: string;
  whatsapp?: string;
  workPhone?: string;
  email?: string;
  status: string;
  statusId: number;
  source?: string;
  sourceId?: number;
  project?: string;
  projectId?: number;
  assignedTo?: string;
  assignedToId?: number;
  teamLeader?: string;
  teamLeaderId?: number;
  comments?: Comment[];
  date: string;
  isPotential: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Client requirements (leads only). */
  requirements?: LeadRequirements;
}

// Client requirements of a lead (stored by the backend in lead_requirements + link tables)
export type DeliveryOption = 'ready_to_move' | 'within_1_year' | 'within_2_years' | 'within_3_years' | 'within_4_years';
export type FinishingOption = 'fully_finished' | 'semi_finished' | 'core_and_shell';
/** End User / Investment are offered; personal_living / upgrading only exist on older leads. */
export type PurposeOption = 'end_user' | 'investment' | 'personal_living' | 'upgrading';

export interface LeadRequirements {
  destinationIds: number[];
  propertyTypeIds: number[];
  budgetMin: number | null;
  budgetMax: number | null;
  delivery: DeliveryOption | null;
  finishing: FinishingOption | null;
  downPayment: number | null;
  installmentPerQuarter: number | null;
  purpose: PurposeOption | null;
}

/** An admin-managed choice (destination, property type). */
export interface CrmOption {
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ChoiceOption<T extends string = string> {
  value: T;
  label: string;
}

export interface LeadOptions {
  destinations: CrmOption[];
  propertyTypes: CrmOption[];
  delivery: ChoiceOption<DeliveryOption>[];
  finishing: ChoiceOption<FinishingOption>[];
  purpose: ChoiceOption<PurposeOption>[];
}

/** One logged call (table call_history). Older rows may lack delivery / finishing / purpose. */
export interface CallRecord {
  id: number;
  entityType: 'lead' | 'cold_call';
  leadId: number | null;
  coldCallId: number | null;
  entityName: string;
  entityPhone: string;
  userId: number | null;
  userName: string;
  outcome: string;
  outcomeLabel: string;
  statusId: number | null;
  statusName: string;
  delivery: string | null;
  deliveryLabel: string | null;
  finishing: string | null;
  finishingLabel: string | null;
  purpose: string | null;
  purposeLabel: string | null;
  notes: string;
  callAt: string;
  followUpAt: string | null;
  followUpEventId: number | null;
  commentId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEntry {
  kind: 'call' | 'comment' | 'follow_up';
  at: string;
  id: string;
  call?: CallRecord;
  comment?: Comment;
  followUp?: { id: number; title: string; notes: string; startAt: string; userId: number | null };
}

export interface RecordActivity {
  calls: CallRecord[];
  comments: Comment[];
  followUps: { id: number; title: string; notes: string; startAt: string; userId: number | null }[];
  timeline: ActivityEntry[];
}

// Comment/Report Types
export interface Comment {
  id: number;
  leadId: number;
  entityType?: 'lead' | 'cold_call';
  entityId?: number;
  content: string;
  createdBy: string;
  createdById: number;
  createdAt: string;
}

export interface Report {
  id: number;
  commentId: number;
  leadId?: number | null;
  coldCallId?: number | null;
  entityType: 'lead' | 'cold_call';
  entityId?: number | null;
  clientName: string;
  clientPhone: string;
  agentId?: number | null;
  agentName: string;
  teamLeaderId?: number | null;
  teamLeaderName: string;
  statusId?: number | null;
  statusName?: string;
  projectId?: number | null;
  projectName?: string;
  developerId?: number | null;
  developerName?: string;
  content: string;
  createdBy: string;
  createdById?: number | null;
  createdAt: string;
  updatedAt?: string;
}

// Deal Types
export interface Deal {
  id: number;
  leadId: number;
  leadName: string;
  clientPhone?: string;
  agentId: number;
  agentName: string;
  projectId: number;
  projectName: string;
  developerId: number;
  developerName: string;
  amount: number;
  commission: number;
  status: 'pending' | 'approved' | 'rejected';
  stage?: string;
  reservationPrice?: number;
  reservationDate?: string;
  contractPrice?: number;
  contractDate?: string;
  unitNumber?: string;
  createdAt?: string;
  date: string;
  notes?: string;
  attachments?: DealFileItem[];
  reservationImages?: DealFileItem[];
}

export interface DealFileItem {
  name: string;
  url: string;
  type?: string;
  size?: number;
  uploadedAt?: string;
}

// Agent Care Types
export interface AgentCare {
  id: number;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
}

export interface Department {
  id: number;
  name: string;
}

export interface JobTitle {
  id: number;
  name: string;
  departmentId?: number | null;
  departmentName?: string;
}

export interface Broker {
  id: number;
  name: string;
  phone?: string;
  developerId?: number | null;
  developerName?: string;
}

export interface CalendarEvent {
  id: number;
  title: string;
  type?: string;
  notes?: string;
  startAt?: string;
  endAt?: string;
  dueDate?: string;
  leadId?: number | null;
  coldCallId?: number | null;
  dealId?: number | null;
  userId?: number | null;
}

export interface TaskItem {
  id: number;
  title: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  assignedToId?: number | null;
  leadId?: number | null;
  notes?: string;
}

export interface KnowledgeBaseItem {
  id: number;
  title: string;
  category?: string;
  content?: string;
  projectId?: number | null;
  developerId?: number | null;
  priceRange?: string;
  paymentPlan?: string;
  deliveryDate?: string;
}

export interface CallHistoryItem {
  id: number;
  leadId?: number | null;
  coldCallId?: number | null;
  userId?: number | null;
  result?: string;
  notes?: string;
  callAt?: string;
}

export interface PipelineItem {
  id: number;
  title: string;
  stage?: string;
  value?: number;
  ownerId?: number | null;
  leadId?: number | null;
  dealId?: number | null;
  notes?: string;
}

export interface NotificationItem {
  id: number;
  userId?: number | null;
  title: string;
  body?: string;
  isRead?: boolean;
}

export interface ActivityLog {
  id: number;
  userId?: number | null;
  userName?: string;
  entityType?: string;
  entityId?: number | null;
  action?: string;
  summary?: string;
  metadata?: unknown;
  createdAt?: string;
}

// Filter Types
export interface LeadFilters {
  status?: string;
  source?: string;
  project?: string;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
  isPotential?: boolean;
}

// Dashboard Stats
export interface DashboardStats {
  totalLeads: number;
  totalColdCalls: number;
  totalDeals: number;
  totalCommission: number;
  newLeads: number;
  potentialLeads: number;
  closedDeals: number;
}
