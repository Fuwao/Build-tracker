function escapeCsvCell(value: string): string {
  const v = value ?? '';
  if (/[",\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  return lines.join('\r\n');
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const csvBody = buildCsv(headers, rows);
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvBody], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
