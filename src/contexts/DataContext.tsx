import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { AgentCare, Comment, CrmOption, Deal, Developer, Lead, LeadOptions, LeadSource, Project, Report, Status, Title, User } from '@/types';
import { ApiError, apiFetch, errorMessage, getAuthToken, readApiError } from '@/lib/api';

/**
 * Everything the screens show comes from the API (there is no mock/offline data). Each resource loads independently,
 * so one failing endpoint does not blank the whole app; failures are surfaced through `loadError` + `reload()`.
 */
type Resource =
  | 'users' | 'titles' | 'developers' | 'projects' | 'statuses' | 'leadSources' | 'leads' | 'coldCalls'
  | 'comments' | 'reports' | 'deals' | 'agentCare' | 'leadOptions';

const ENDPOINTS: Record<Resource, string> = {
  users: 'users', titles: 'titles', developers: 'developers', projects: 'projects', statuses: 'statuses',
  leadSources: 'lead-sources', leads: 'leads', coldCalls: 'cold-calls', comments: 'comments', reports: 'reports',
  deals: 'deals', agentCare: 'agent-care', leadOptions: 'lead-options',
};

const EMPTY_OPTIONS: LeadOptions = { destinations: [], propertyTypes: [], delivery: [], finishing: [], purpose: [] };

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
  /** The support contact card (null until loaded / when none is configured). */
  agentCare: AgentCare | null;
  setAgentCare: Dispatch<SetStateAction<AgentCare | null>>;
  /** Choices for lead requirements (destinations, property types, delivery, finishing, purpose). */
  leadOptions: LeadOptions;
  destinations: CrmOption[];
  propertyTypes: CrmOption[];
  /** true until the first load finished (successfully or not). */
  isLoading: boolean;
  /** Message of the last failed load, '' when everything loaded. */
  loadError: string;
  /** Reloads the given resources (all when omitted) from the server. */
  reload: (resources?: Resource[]) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

async function fetchJson<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) throw await readApiError(response);
  return response.json() as Promise<T>;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [coldCalls, setColdCalls] = useState<Lead[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [agentCare, setAgentCare] = useState<AgentCare | null>(null);
  const [leadOptions, setLeadOptions] = useState<LeadOptions>(EMPTY_OPTIONS);
  const [authToken, setAuthToken] = useState<string>(() => getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(getAuthToken()));
  const [loadError, setLoadError] = useState('');
  const generation = useRef(0);

  useEffect(() => {
    const sync = () => setAuthToken(getAuthToken());
    window.addEventListener('storage', sync);
    window.addEventListener('mentors-auth-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('mentors-auth-change', sync);
    };
  }, []);

  const apply = useCallback((resource: Resource, data: unknown) => {
    switch (resource) {
      case 'users': setUsers(data as User[]); break;
      case 'titles': setTitles(data as Title[]); break;
      case 'developers': setDevelopers(data as Developer[]); break;
      case 'projects': setProjects(data as Project[]); break;
      case 'statuses': setStatuses(data as Status[]); break;
      case 'leadSources': setLeadSources(data as LeadSource[]); break;
      case 'leads': setLeads(data as Lead[]); break;
      case 'coldCalls': setColdCalls(data as Lead[]); break;
      case 'comments': setComments(data as Comment[]); break;
      case 'reports': setReports(data as Report[]); break;
      case 'deals': setDeals(data as Deal[]); break;
      case 'agentCare': setAgentCare(((data as AgentCare[])[0]) ?? null); break;
      case 'leadOptions': setLeadOptions({ ...EMPTY_OPTIONS, ...(data as LeadOptions) }); break;
      default: break;
    }
  }, []);

  const reload = useCallback(async (resources?: Resource[]) => {
    if (!getAuthToken()) return;
    const run = generation.current;
    const list = resources ?? (Object.keys(ENDPOINTS) as Resource[]);
    const results = await Promise.allSettled(list.map((r) => fetchJson(ENDPOINTS[r])));
    if (run !== generation.current) return; // signed out / switched account meanwhile
    const failures: string[] = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') apply(list[i], result.value);
      // agents have no access to Developers (403 by design): an empty list, not an error banner
      else if (list[i] === 'developers' && result.reason instanceof ApiError && result.reason.status === 403) apply('developers', []);
      else failures.push(errorMessage(result.reason));
    });
    setLoadError(failures.length ? `Some data could not be loaded: ${[...new Set(failures)].join(' ')}` : '');
    setIsLoading(false);
  }, [apply]);

  // Account changed (sign-in, sign-out, another user): reset during render - React's recommended pattern for state that
  // depends on a changing value - so no screen ever shows the previous account's data, even for one frame.
  const [loadedFor, setLoadedFor] = useState(authToken);
  if (loadedFor !== authToken) {
    setLoadedFor(authToken);
    setUsers([]); setTitles([]); setDevelopers([]); setProjects([]); setStatuses([]); setLeadSources([]);
    setLeads([]); setColdCalls([]); setComments([]); setReports([]); setDeals([]); setAgentCare(null);
    setLeadOptions(EMPTY_OPTIONS); setLoadError(''); setIsLoading(Boolean(authToken));
  }

  useEffect(() => {
    generation.current += 1;
    // Fetching from the server when the signed-in account changes is exactly what effects are for; every setState in
    // reload() happens after an await (the rule cannot see that).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (authToken) void reload();
  }, [authToken, reload]);

  const value = useMemo<DataContextType>(() => ({
    users, setUsers, titles, setTitles, developers, setDevelopers, projects, setProjects, statuses, setStatuses,
    leadSources, setLeadSources, leads, setLeads, coldCalls, setColdCalls, comments, setComments, reports, setReports,
    deals, setDeals, agentCare, setAgentCare, leadOptions,
    destinations: leadOptions.destinations, propertyTypes: leadOptions.propertyTypes,
    isLoading, loadError, reload,
  }), [users, titles, developers, projects, statuses, leadSources, leads, coldCalls, comments, reports, deals, agentCare, leadOptions, isLoading, loadError, reload]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
}
