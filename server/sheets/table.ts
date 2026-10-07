/**
 * Spreadsheet plumbing: header-name matching and tolerant value parsing.
 * Nothing here knows about Tasks or Projects, and nothing depends on column order.
 */

export type Cell = string | number | boolean | null | undefined;
export type Grid = Cell[][];

/** "In Progress ", "in-progress" and "in_progress" all become "in_progress". */
export function slug(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export interface Table {
  /** Normalised header names, in sheet order. Empty headers stay '' so column letters stay correct. */
  headers: string[];
  /** Original header text, for diagnostics. */
  rawHeaders: string[];
  /** Data rows with their 1-based sheet row number (header is row 1). */
  rows: { rowNumber: number; cells: Cell[] }[];
}

export function parseTable(grid: Grid | undefined): Table {
  const [head = [], ...body] = grid ?? [];
  const headers = head.map((h) => slug(h));
  const rows = body
    .map((cells, i) => ({ rowNumber: i + 2, cells }))
    .filter((r) => r.cells.some((c) => c !== '' && c !== null && c !== undefined));
  return { headers, rawHeaders: head.map((h) => String(h ?? '')), rows };
}

/** 0-based column index to A1 letters: 0 → A, 26 → AA. */
export function columnLetter(index: number): string {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** First header that matches the field name or one of its aliases; -1 if the column is absent. */
export function findColumn(headers: string[], names: string[]): number {
  for (const name of names) {
    const i = headers.indexOf(slug(name));
    if (i !== -1) return i;
  }
  return -1;
}

/* ---------- value parsing (tolerant: blank and unreadable values become null) ---------- */

const isBlank = (c: Cell) => c === undefined || c === null || (typeof c === 'string' && c.trim() === '');

export function parseString(c: Cell): string | null {
  if (isBlank(c)) return null;
  const s = String(c).trim();
  return s === '' ? null : s;
}

export function parseInt0(c: Cell): number | null {
  if (isBlank(c)) return null;
  if (typeof c === 'number') return Number.isFinite(c) ? Math.round(c) : null;
  const digits = String(c).replace(/[^\d.-]/g, '');
  if (!/\d/.test(digits)) return null; // "abc" is not zero
  const n = Number(digits);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parseBool(c: Cell): boolean | null {
  if (typeof c === 'boolean') return c;
  if (isBlank(c)) return null;
  const s = slug(c);
  if (['true', 'yes', 'y', '1', 'x', 'checked'].includes(s)) return true;
  if (['false', 'no', 'n', '0'].includes(s)) return false;
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Sheets serial day number → UTC Date. 25569 is 1970-01-01. */
function fromSerial(n: number): Date {
  return new Date(Math.round((n - 25569) * 86_400_000));
}

export interface ParsedDate {
  /** YYYY-MM-DD */
  day: string;
  /** Full ISO timestamp when the value carried a time, else null. */
  iso: string | null;
}

/**
 * Accepts Sheets serial numbers, ISO dates and datetimes, and "7 Oct 2026"-style text.
 * Day-first "07/10/2026" is read as day/month/year (the brief is written for a UK reader).
 */
export function parseDate(c: Cell): ParsedDate | null {
  if (isBlank(c)) return null;
  if (typeof c === 'number') {
    if (!Number.isFinite(c) || c < 1) return null;
    const d = fromSerial(c);
    const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    return { day, iso: Number.isInteger(c) ? null : d.toISOString() };
  }
  const s = String(c).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return { day: s, iso: null };
  m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s);
  if (m) {
    const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(' ', 'T')}Z`);
    return Number.isNaN(d.getTime()) ? null : { day: `${m[1]}-${m[2]}-${m[3]}`, iso: d.toISOString() };
  }
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(s);
  if (m) return { day: `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`, iso: null };
  const t = Date.parse(`${s} 12:00 UTC`);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return { day: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, iso: null };
  }
  return null;
}

export const parseDay = (c: Cell): string | null => parseDate(c)?.day ?? null;

/** Timestamp: the instant if known, otherwise noon UTC of the day. */
export function parseTimestamp(c: Cell): string | null {
  const d = parseDate(c);
  if (!d) return null;
  return d.iso ?? `${d.day}T12:00:00.000Z`;
}

/**
 * Deadline: a date without a time means "by the end of that day", written without an offset
 * so the browser reads it as the end of the local day.
 */
export function parseDeadline(c: Cell): string | null {
  const d = parseDate(c);
  if (!d) return null;
  return d.iso ?? `${d.day}T23:59:59`;
}

/* ---------- value serialisation (what we write back) ---------- */

export function toCell(kind: 'str' | 'int' | 'bool' | 'date' | 'datetime' | 'deadline', v: unknown): Cell {
  if (v === null || v === undefined) return '';
  switch (kind) {
    case 'bool':
      return Boolean(v);
    case 'int':
      return typeof v === 'number' ? v : Number(v);
    case 'date':
      return String(v).slice(0, 10);
    case 'deadline': {
      // The browser sends an instant; the sheet keeps a plain date unless a time was meant.
      const s = String(v);
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : s.slice(0, 10);
    }
    case 'datetime':
      return String(v);
    default:
      return String(v);
  }
}
