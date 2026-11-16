import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Copy, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import { copyRows, exportExcel, exportPdf, type ExportRow } from '@/lib/exporters';
import { errorMessage } from '@/lib/api';

interface Props {
  /** Rows to export: the selection when something is selected, otherwise every row matching the current filters. */
  rows: () => ExportRow[] | Promise<ExportRow[]>;
  scopeLabel: string;
  title: string;
  baseName: string;
}

/** Copy / Excel / PDF of the rows the user is looking at. Each button really produces the output (no placeholders). */
export function ExportButtons({ rows, scopeLabel, title, baseName }: Props) {
  const [busy, setBusy] = useState<'' | 'copy' | 'excel' | 'pdf'>('');
  const run = async (kind: 'copy' | 'excel' | 'pdf') => {
    let data: ExportRow[];
    try {
      data = await rows();
    } catch (error) {
      toast.error(`Export failed: ${errorMessage(error)}`);
      return;
    }
    if (!data.length) {
      toast.error('Nothing to export - no rows match the current filters');
      return;
    }
    try {
      if (kind === 'copy') {
        setBusy('copy');
        const n = await copyRows(data);
        toast.success(`Copied ${n} ${scopeLabel} to the clipboard`);
      } else if (kind === 'excel') {
        setBusy('excel');
        const n = await exportExcel(data, baseName, title.slice(0, 31));
        toast.success(`Exported ${n} ${scopeLabel} to Excel`);
      } else {
        setBusy('pdf');
        const n = await exportPdf(data, title, baseName);
        toast.success(`Exported ${n} ${scopeLabel} to PDF`);
      }
    } catch (error) {
      toast.error(`Export failed: ${errorMessage(error)}`);
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => void run('copy')} disabled={busy === 'copy'} title={`Copy ${scopeLabel}`}>
        <Copy className="mr-2 h-4 w-4" />
        Copy
      </Button>
      <Button variant="outline" size="sm" onClick={() => void run('excel')} disabled={busy === 'excel'} title={`Download ${scopeLabel} as Excel`}>
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => void run('pdf')} disabled={busy === 'pdf'} title={`Download ${scopeLabel} as PDF`}>
        <FileIcon className="mr-2 h-4 w-4" />
        {busy === 'pdf' ? 'PDF...' : 'PDF'}
      </Button>
    </>
  );
}
