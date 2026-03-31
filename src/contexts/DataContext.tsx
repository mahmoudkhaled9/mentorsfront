import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { 
  User, 
  Title, 
  Developer, 
  Project, 
  Status, 
  LeadSource, 
  Lead, 
  Comment, 
  Report,
  Deal, 
  AgentCare 
} from '@/types';
import { apiFetch, emitAuthChange, getApiBase, getAuthToken } from '@/lib/api';
import {
  users as initialUsers,
  titles as initialTitles,
  developers as initialDevelopers,
  projects as initialProjects,
  statuses as initialStatuses,
  leadSources as initialLeadSources,
  leads as initialLeads,
  coldCalls as initialColdCalls,
  comments as initialComments,
  reports as initialReports,
  deals as initialDeals,
  agentCare as initialAgentCare,
} from '@/data/mockData';

interface DataContextType {
  users: User[];
  setUsers: Dispatch<SetStateAction<User[]>>;
  titles: Title[];
  setTitles: Dispatch<SetStateAction<Title[]>>;
  developers: Developer[];
  setDevelopers: Dispatch<SetStateAction<Developer[]>>;
  projects: Project[];
  setProjects: Dispatch<SetStateAction<Project[]>>;
  statuses: Status[];
  setStatuses: Dispatch<SetStateAction<Status[]>>;
  leadSources: LeadSource[];
  setLeadSources: Dispatch<SetStateAction<LeadSource[]>>;
  leads: Lead[];
  setLeads: Dispatch<SetStateAction<Lead[]>>;
  coldCalls: Lead[];
  setColdCalls: Dispatch<SetStateAction<Lead[]>>;
  comments: Comment[];
  setComments: Dispatch<SetStateAction<Comment[]>>;
  reports: Report[];
  setReports: Dispatch<SetStateAction<Report[]>>;
  deals: Deal[];
  setDeals: Dispatch<SetStateAction<Deal[]>>;
  agentCare: AgentCare;
  setAgentCare: Dispatch<SetStateAction<AgentCare>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const apiBase = getApiBase();
  const hasApiBase = Boolean(apiBase);
  const [users, setUsers] = useState<User[]>(() => (hasApiBase ? [] : initialUsers));
  const [titles, setTitles] = useState<Title[]>(() => (hasApiBase ? [] : initialTitles));
  const [developers, setDevelopers] = useState<Developer[]>(() => (hasApiBase ? [] : initialDevelopers));
  const [projects, setProjects] = useState<Project[]>(() => (hasApiBase ? [] : initialProjects));
  const [statuses, setStatuses] = useState<Status[]>(() => (hasApiBase ? [] : initialStatuses));
  const [leadSources, setLeadSources] = useState<LeadSource[]>(() => (hasApiBase ? [] : initialLeadSources));
  const [leads, setLeads] = useState<Lead[]>(() => (hasApiBase ? [] : initialLeads));
  const [coldCalls, setColdCalls] = useState<Lead[]>(() => (hasApiBase ? [] : initialColdCalls));
  const [comments, setComments] = useState<Comment[]>(() => (hasApiBase ? [] : initialComments));
  const [reports, setReports] = useState<Report[]>(() => (hasApiBase ? [] : initialReports));
  const [deals, setDeals] = useState<Deal[]>(() => (hasApiBase ? [] : initialDeals));
  const [agentCare, setAgentCare] = useState<AgentCare>(initialAgentCare);
  const [authToken, setAuthToken] = useState<string>(() => getAuthToken());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncAuthToken = () => setAuthToken(getAuthToken());
    syncAuthToken();
    window.addEventListener('storage', syncAuthToken);
    window.addEventListener('mentors-auth-change', syncAuthToken as EventListener);
    return () => {
      window.removeEventListener('storage', syncAuthToken);
      window.removeEventListener('mentors-auth-change', syncAuthToken as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!hasApiBase || typeof window === 'undefined') return;
    [
      'tcrs_users',
      'tcrs_titles',
      'tcrs_developers',
      'tcrs_projects',
      'tcrs_statuses',
      'tcrs_lead_sources',
      'tcrs_leads',
      'tcrs_cold_calls',
      'tcrs_comments',
      'tcrs_reports',
      'tcrs_deals',
      'tcrs_agent_care',
    ].forEach(key => window.localStorage.removeItem(key));
  }, [hasApiBase]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedUser = window.localStorage.getItem('tcrs_auth_user');
      if (storedUser && hasApiBase) {
        const parsed = JSON.parse(storedUser) as User;
        if (!parsed?.email) {
          window.localStorage.removeItem('tcrs_auth_user');
        }
      }
    } catch {
      window.localStorage.removeItem('tcrs_auth_user');
    }
  }, [hasApiBase]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('tcrs_agent_care');
      if (!stored) {
        setAgentCare(initialAgentCare);
        return;
      }
      const parsed = JSON.parse(stored) as AgentCare;
      if (parsed.phone === '01021128292' || parsed.email === 'support@tcrs.com') {
        setAgentCare(initialAgentCare);
      }
    } catch {
      setAgentCare(initialAgentCare);
    }
  }, [setAgentCare]);

  useEffect(() => {
    if (!apiBase || !authToken) {
      if (hasApiBase) {
        setUsers([]);
        setTitles([]);
        setDevelopers([]);
        setProjects([]);
        setStatuses([]);
        setLeadSources([]);
        setLeads([]);
        setColdCalls([]);
        setComments([]);
        setReports([]);
        setDeals([]);
      }
      return;
    }
    let cancelled = false;
    let retryTimer: number | undefined;

    const loadApiData = async () => {
      try {
        const fetchJson = async <T,>(path: string): Promise<T> => {
          const response = await apiFetch(path);
          if (!response.ok) {
            if (response.status === 401) {
              throw new Error('unauthorized');
            }
            throw new Error(`Failed to load ${path}`);
          }
          return response.json();
        };

        const [
          usersData,
          titlesData,
          developersData,
          projectsData,
          statusesData,
          sourcesData,
          leadsData,
          coldCallsData,
          commentsData,
          reportsData,
          dealsData,
          agentCareData,
        ] = await Promise.all([
          fetchJson<User[]>('users'),
          fetchJson<Title[]>('titles'),
          fetchJson<Developer[]>('developers'),
          fetchJson<Project[]>('projects'),
          fetchJson<Status[]>('statuses'),
          fetchJson<LeadSource[]>('lead-sources'),
          fetchJson<Lead[]>('leads'),
          fetchJson<Lead[]>('cold-calls'),
          fetchJson<Comment[]>('comments'),
          fetchJson<Report[]>('reports'),
          fetchJson<Deal[]>('deals'),
          fetchJson<AgentCare[]>('agent-care'),
        ]);

        if (cancelled) return;

        setUsers(usersData);
        setTitles(titlesData);
        setDevelopers(developersData);
        setProjects(projectsData);
        setStatuses(statusesData);
        setLeadSources(sourcesData);
        setLeads(leadsData);
        setColdCalls(coldCallsData);
        setComments(commentsData);
        setReports(reportsData);
        setDeals(dealsData);
        setAgentCare(agentCareData[0] ?? initialAgentCare);
      } catch (error) {
        if (String((error as Error)?.message ?? '').toLowerCase().includes('unauthorized')) {
          if (!cancelled && typeof window !== 'undefined') {
            window.localStorage.removeItem('mentors_auth_token');
            emitAuthChange();
          }
          return;
        }
        console.error('Failed to load API data', error);
        if (!cancelled) {
          retryTimer = window.setTimeout(loadApiData, 4000);
        }
      }
    };

    loadApiData();

    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [
    apiBase,
    authToken,
    setUsers,
    setTitles,
    setDevelopers,
    setProjects,
    setStatuses,
    setLeadSources,
    setLeads,
    setColdCalls,
    setComments,
    setReports,
    setDeals,
    setAgentCare,
  ]);

  const value = useMemo(
    () => ({
      users,
      setUsers,
      titles,
      setTitles,
      developers,
      setDevelopers,
      projects,
      setProjects,
      statuses,
      setStatuses,
      leadSources,
      setLeadSources,
      leads,
      setLeads,
      coldCalls,
      setColdCalls,
      comments,
      setComments,
      reports,
      setReports,
      deals,
      setDeals,
      agentCare,
      setAgentCare,
    }),
    [
      users,
      titles,
      developers,
      projects,
      statuses,
      leadSources,
      leads,
      coldCalls,
      comments,
      reports,
      deals,
      agentCare,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
