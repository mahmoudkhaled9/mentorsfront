import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileSpreadsheet, UploadCloud, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { LeadType, Project } from '@/types';
import { jsonRequest } from '@/lib/mutations';

GlobalWorkerOptions.workerSrc = pdfWorker;

type ImportTarget = 'leads' | 'coldCalls';

type ImportStats = {
  totalRows: number;
  duplicatesRemoved: number;
  imported: number;
  skipped: number;
};

type UploadRow = {
  name?: string;
  phone: string;
  status?: string;
  project?: string;
  assignedTo?: string;
};

const MAX_ROWS = 1000;

const normalizeHeader = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]/g, '');

const normalizePhone = (value: string) => value.replace(/\D/g, '');

const phoneRegex = /(\+?\d[\d\s\-()]{6,}\d)/g;

export default function UploadData() {
  const { leads, setLeads, coldCalls, setColdCalls, statuses, users, projects, setProjects, developers } = useData();
  const [importTarget, setImportTarget] = useState<ImportTarget>('leads');
  const [file, setFile] = useState<File | null>(null);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const defaultStatus = statuses.find(s => s.name === 'New Lead')?.name || statuses[0]?.name || 'New Lead';

  const findStatus = (value?: string) => {
    if (!value) return defaultStatus;
    const normalized = value.trim().toLowerCase();
    return statuses.find(s => s.name.toLowerCase() === normalized)?.name || defaultStatus;
  };

  const findAssignee = (value?: string) => {
    if (!value) return undefined;
    const normalized = value.trim().toLowerCase();
    return users.find(u => u.name.toLowerCase() === normalized);
  };

  const buildUploadRowsFromSheet = (rows: unknown[][]) => {
    if (rows.length <= 1) {
      return { rows: [], totalRows: 0, error: 'No data rows found' };
    }
    const headers = rows[0].map(normalizeHeader);
    const phoneIndex = headers.findIndex(h => ['phone', 'mobile', 'phonenumber'].includes(h));
    if (phoneIndex === -1) {
      return { rows: [], totalRows: rows.length - 1, error: 'Phone column not found' };
    }
    const nameIndex = headers.findIndex(h => ['name', 'fullname', 'clientname'].includes(h));
    const statusIndex = headers.findIndex(h => ['status'].includes(h));
    const projectIndex = headers.findIndex(h =>
      ['project', 'projectname', 'projecttitle', 'projectnames', 'projectnameen', 'projectnamear'].includes(h) ||
      h.includes('project')
    );
    const assignedIndex = headers.findIndex(h => ['assignedto', 'assignee'].includes(h));

    const result: UploadRow[] = [];
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const phone = String(row[phoneIndex] ?? '').trim();
      if (!phone) {
        result.push({ phone: '' });
        continue;
      }
      result.push({
        phone,
        name: nameIndex >= 0 ? String(row[nameIndex] ?? '').trim() : undefined,
        status: statusIndex >= 0 ? String(row[statusIndex] ?? '').trim() : undefined,
        project: projectIndex >= 0 ? String(row[projectIndex] ?? '').trim() : undefined,
        assignedTo: assignedIndex >= 0 ? String(row[assignedIndex] ?? '').trim() : undefined,
      });
    }
    return { rows: result, totalRows: rows.length - 1 };
  };

  const extractTextFromPdf = async (buffer: ArrayBuffer) => {
    const pdf = await getDocument({ data: buffer }).promise;
    let text = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');
      text += ` ${pageText}`;
    }
    return text;
  };

  const importRows = async (rawRows: UploadRow[], totalRows: number) => {
    if (totalRows > MAX_ROWS) {
      toast.error(`File has ${totalRows} rows. Max allowed is ${MAX_ROWS}.`);
      return;
    }

    const existingPhones = new Set(
      (importTarget === 'leads' ? leads : coldCalls)
        .map(item => normalizePhone(item.phone))
        .filter(Boolean)
    );
    const seenInFile = new Set<string>();
    const validRows: UploadRow[] = [];
    let duplicatesRemoved = 0;
    let skipped = 0;

    rawRows.forEach(row => {
      const normalizedPhone = normalizePhone(row.phone || '');
      if (!normalizedPhone) {
        skipped += 1;
        return;
      }
      if (seenInFile.has(normalizedPhone) || existingPhones.has(normalizedPhone)) {
        duplicatesRemoved += 1;
        return;
      }
      seenInFile.add(normalizedPhone);
      validRows.push(row);
    });

    const targetData = importTarget === 'leads' ? leads : coldCalls;
    let nextId = targetData.length > 0 ? Math.max(...targetData.map(item => item.id)) + 1 : 1;

    const projectMap = new Map(projects.map(project => [project.name.toLowerCase(), project]));
    const addedProjects: Project[] = [];
    let nextProjectId =
      projects.length > 0 ? Math.max(...projects.map(project => project.id)) + 1 : 1;
    const fallbackDeveloper = developers[0];

    const resolveProject = (value?: string) => {
      if (!value) return undefined;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const key = trimmed.toLowerCase();
      const existing = projectMap.get(key);
      if (existing) return existing;
      if (importTarget !== 'leads') return undefined;
      const nextProject: Project = {
        id: nextProjectId++,
        name: trimmed,
        developerId: fallbackDeveloper?.id ?? 0,
        developerName: fallbackDeveloper?.name ?? 'Unknown',
      };
      projectMap.set(key, nextProject);
      addedProjects.push(nextProject);
      return nextProject;
    };

    const newItems = validRows.map(row => {
      const statusName = findStatus(row.status);
      const statusObj = statuses.find(s => s.name === statusName);
      const assignee = findAssignee(row.assignedTo);
      const projectObj = resolveProject(row.project);
      const isPotential =
        statusName.toLowerCase().includes('potential') &&
        !statusName.toLowerCase().includes('non');

      const item = {
        id: nextId++,
        type: (importTarget === 'leads' ? 'Lead' : 'Coldcall') as LeadType,
        name: row.name?.trim() || 'Unknown',
        phone: row.phone,
        status: statusName,
        statusId: statusObj?.id ?? 0,
        project: projectObj?.name,
        projectId: projectObj?.id,
        assignedTo: assignee?.name,
        assignedToId: assignee?.id,
        date: new Date().toISOString().split('T')[0],
        isPotential,
      };
      return item;
    });

    try {
      if (addedProjects.length > 0) {
        await Promise.all(
          addedProjects.map((project) =>
            jsonRequest('projects', {
              method: 'POST',
              body: {
                name: project.name,
                developerId: project.developerId,
              },
            })
          )
        );
        setProjects(prev => [...prev, ...addedProjects]);
      }

      if (newItems.length > 0) {
        await jsonRequest(importTarget === 'leads' ? 'leads/import' : 'cold-calls/import', {
          method: 'POST',
          body: { rows: newItems },
        });
      }

      if (importTarget === 'leads') {
        setLeads(prev => [...prev, ...newItems]);
      } else {
        setColdCalls(prev => [...prev, ...newItems]);
      }

      setStats({
        totalRows,
        duplicatesRemoved,
        imported: newItems.length,
        skipped,
      });

      toast.success(`Imported ${newItems.length} records.`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }
    setIsUploading(true);
    setStats(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension) {
        toast.error('Invalid file');
        return;
      }

      if (extension === 'pdf') {
        const buffer = await file.arrayBuffer();
        const text = await extractTextFromPdf(buffer);
        const matches = text.match(phoneRegex) || [];
        if (matches.length > MAX_ROWS) {
          toast.error(`PDF has ${matches.length} numbers. Max allowed is ${MAX_ROWS}.`);
          return;
        }
        const rows: UploadRow[] = matches.map(phone => ({
          phone: phone.trim(),
          name: 'Unknown',
          status: defaultStatus,
        }));
        await importRows(rows, matches.length);
        return;
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) {
        toast.error('No sheet found in file');
        return;
      }
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
      const { rows: parsedRows, totalRows, error } = buildUploadRowsFromSheet(rows);
      if (error) {
        toast.error(error);
        return;
      }
      await importRows(parsedRows, totalRows);
    } catch (error) {
      toast.error('Upload failed. Please check the file and try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Data</h1>
        <p className="text-gray-500 mt-1">Import leads or cold calls from Excel, CSV, or PDF</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5" />
            Import Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={importTarget} onValueChange={(value) => setImportTarget(value as ImportTarget)}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue placeholder="Import to" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="leads">Leads</SelectItem>
              <SelectItem value="coldCalls">Cold Calls</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center">
            <Input
              id="upload-data-file"
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <label htmlFor="upload-data-file" className="cursor-pointer">
                Choose File
              </label>
            </Button>
            <div className="min-w-0 flex-1 rounded-md border bg-white px-3 py-2 text-sm text-gray-600">
              <span className="block truncate">
                {file ? file.name : 'No file selected'}
              </span>
            </div>
          </div>

          <Button onClick={handleUpload} disabled={isUploading}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
        </CardContent>
      </Card>

      {stats && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              Import Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-green-800">
            <p>Total rows read: <strong>{stats.totalRows}</strong></p>
            <p>Duplicates removed: <strong>{stats.duplicatesRemoved}</strong></p>
            <p>Imported: <strong>{stats.imported}</strong></p>
            <p>Skipped (invalid/missing phone): <strong>{stats.skipped}</strong></p>
          </CardContent>
        </Card>
      )}

      {!stats && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-800 space-y-2">
            <p>Max 1000 rows per upload.</p>
            <p>Duplicate phone numbers are removed automatically.</p>
            <p>PDF imports extract phone numbers only.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
