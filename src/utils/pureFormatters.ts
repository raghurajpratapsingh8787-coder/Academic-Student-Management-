export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatDisplayDate(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return '—';
  const parsed = new Date(isoOrDate.length === 10 ? `${isoOrDate}T00:00:00` : isoOrDate);
  if (Number.isNaN(parsed.getTime())) return isoOrDate;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDisplayDate(iso);
}

/**
 * Neutralizes spreadsheet formula injection (=, +, -, @) and applies RFC-4180 CSV quoting.
 */
export function sanitizeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  const formulaSafe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(formulaSafe)) {
    return `"${formulaSafe.replace(/"/g, '""')}"`;
  }
  return formulaSafe;
}

export function buildCsvContent(headers: string[], rows: Array<Array<unknown>>): string {
  const headerLine = headers.map(sanitizeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(sanitizeCsvCell).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}
