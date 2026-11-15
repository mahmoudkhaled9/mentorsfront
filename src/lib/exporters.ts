/** One exported row: column title -> value. The same rows feed Copy, Excel and PDF so they always agree. */
export type ExportRow = Record<string, string | number | null | undefined>;

const cell = (value: ExportRow[string]) => (value === null || value === undefined ? '' : String(value));
const stamp = () => new Date().toISOString().slice(0, 10);

/** Copies rows as tab-separated text (pastes cleanly into Excel / Google Sheets). Resolves to the number of rows. */
export async function copyRows(rows: ExportRow[]): Promise<number> {
  if (!rows.length) throw new Error('There is nothing to copy');
  const headers = Object.keys(rows[0]);
  const text = [headers.join('\t'), ...rows.map((r) => headers.map((h) => cell(r[h]).replace(/[\t\n]/g, ' ')).join('\t'))].join('\n');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    // older browsers / non-secure origins
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('The browser blocked clipboard access');
  }
  return rows.length;
}

/** Excel export. SheetJS (~420 kB) is loaded only when somebody exports, not with every page load. */
export async function exportExcel(rows: ExportRow[], baseName: string, sheetName = 'Data'): Promise<number> {
  if (!rows.length) throw new Error('There is nothing to export');
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${baseName}-${stamp()}.xlsx`);
  return rows.length;
}

/** A simple landscape table PDF (jsPDF is loaded only when somebody exports). */
export async function exportPdf(rows: ExportRow[], title: string, baseName: string): Promise<number> {
  if (!rows.length) throw new Error('There is nothing to export');
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const headers = Object.keys(rows[0]);
  const margin = 32;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const colWidth = (pageWidth - margin * 2) / headers.length;
  const lineHeight = 16;
  const fit = (text: string) => {
    let t = text;
    while (t.length > 1 && doc.getTextWidth(t) > colWidth - 6) t = t.slice(0, -2);
    return t === text ? t : `${t}…`;
  };
  let y = margin;
  doc.setFontSize(14);
  doc.text(`${title} (${rows.length})`, margin, y);
  doc.setFontSize(8);
  doc.text(`Exported ${new Date().toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
  y += 22;
  const header = () => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    headers.forEach((h, i) => doc.text(fit(h), margin + i * colWidth + 3, y));
    doc.setFont('helvetica', 'normal');
    doc.line(margin, y + 4, pageWidth - margin, y + 4);
    y += lineHeight;
  };
  header();
  for (const row of rows) {
    if (y > pageHeight - margin) { doc.addPage(); y = margin; header(); }
    headers.forEach((h, i) => doc.text(fit(cell(row[h])), margin + i * colWidth + 3, y));
    y += lineHeight;
  }
  doc.save(`${baseName}-${stamp()}.pdf`);
  return rows.length;
}
