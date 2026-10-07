import { createSign } from 'node:crypto';
import type { Cell, Grid } from './table.js';

/** What the data hub needs from a spreadsheet. A fake implements this for tests and local development. */
export interface SheetsClient {
  /** Whole sheets, as rows of cells. */
  readSheets(names: string[]): Promise<Record<string, Grid>>;
  /** Write single cells (1-based row, 0-based column). */
  updateCells(sheet: string, writes: { row: number; column: number; value: Cell }[]): Promise<void>;
  appendRow(sheet: string, row: Cell[]): Promise<void>;
  deleteRow(sheet: string, row: number): Promise<void>;
}

export class ConfigError extends Error {
  constructor(public missing: string[]) {
    super(`Missing configuration: ${missing.join(', ')}`);
  }
}

export class UpstreamError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export interface GoogleConfig {
  sheetId: string;
  serviceAccountEmail: string;
  privateKey: string;
  /** Only when true do we ask Google for write permission. Read-only is the default. */
  write: boolean;
}

/** Reads configuration from environment variables. Error messages name variables, never values. */
export function googleConfigFromEnv(env: Record<string, string | undefined>): GoogleConfig {
  const missing = ['GOOGLE_SHEETS_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY'].filter((k) => !env[k]?.trim());
  if (missing.length) throw new ConfigError(missing);
  return {
    sheetId: env.GOOGLE_SHEETS_ID!.trim(),
    serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL!.trim(),
    // Vercel stores multi-line values with literal "\n"; also tolerate surrounding quotes.
    privateKey: env.GOOGLE_PRIVATE_KEY!.trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n'),
    write: (env.GOOGLE_SHEETS_WRITE ?? '').toLowerCase() === 'true',
  };
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const TIMEOUT_MS = 12_000;

export function createGoogleSheetsClient(cfg: GoogleConfig, fetchImpl: typeof fetch = fetch): SheetsClient {
  let token: { value: string; expiresAt: number } | null = null;
  let sheetIds: Map<string, number> | null = null;
  const scope = cfg.write ? 'https://www.googleapis.com/auth/spreadsheets' : 'https://www.googleapis.com/auth/spreadsheets.readonly';

  async function call(url: string, init: RequestInit = {}): Promise<any> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(url, { ...init, signal: ctrl.signal });
      if (!res.ok) {
        // Keep the technical detail for server logs only; callers show a calm message.
        const detail = (await res.text().catch(() => '')).slice(0, 300);
        throw new UpstreamError(`Google API ${res.status}: ${detail}`, res.status);
      }
      return await res.json();
    } catch (e) {
      if (e instanceof UpstreamError) throw e;
      throw new UpstreamError(`Google API request failed: ${(e as Error).name}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async function accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (token && token.expiresAt - 60 > now) return token.value;
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = b64url(JSON.stringify({ iss: cfg.serviceAccountEmail, scope, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
    const signature = createSign('RSA-SHA256').update(`${header}.${claim}`).sign(cfg.privateKey);
    const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${b64url(signature)}` });
    const res = await call(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    token = { value: res.access_token as string, expiresAt: now + Number(res.expires_in ?? 3600) };
    return token.value;
  }

  const authed = async (url: string, init: RequestInit = {}) =>
    call(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${await accessToken()}` } });

  const id = encodeURIComponent(cfg.sheetId);
  const quote = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;
  const json = { 'Content-Type': 'application/json' };

  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      const status = (e as UpstreamError).status;
      if (status === 429 || (status !== undefined && status >= 500) || status === undefined) {
        await new Promise((r) => setTimeout(r, 600));
        return fn();
      }
      throw e;
    }
  }

  return {
    async readSheets(names) {
      const qs = names.map((n) => `ranges=${encodeURIComponent(quote(n))}`).join('&');
      const res = await withRetry(() =>
        authed(`${API}/${id}/values:batchGet?${qs}&majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`),
      );
      const out: Record<string, Grid> = {};
      (res.valueRanges ?? []).forEach((vr: { values?: Grid }, i: number) => {
        out[names[i]] = vr.values ?? [];
      });
      return out;
    },

    async updateCells(sheet, writes) {
      if (!cfg.write) throw new UpstreamError('Writes are disabled');
      if (writes.length === 0) return;
      const col = (n: number) => {
        let s = '';
        let x = n;
        do { s = String.fromCharCode(65 + (x % 26)) + s; x = Math.floor(x / 26) - 1; } while (x >= 0);
        return s;
      };
      await authed(`${API}/${id}/values:batchUpdate`, {
        method: 'POST', headers: json,
        body: JSON.stringify({
          valueInputOption: 'RAW', // RAW keeps text as text: a value starting with "=" can never run as a formula
          data: writes.map((w) => ({ range: `${quote(sheet)}!${col(w.column)}${w.row}`, values: [[w.value ?? '']] })),
        }),
      });
    },

    async appendRow(sheet, row) {
      if (!cfg.write) throw new UpstreamError('Writes are disabled');
      await authed(`${API}/${id}/values/${encodeURIComponent(`${quote(sheet)}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST', headers: json, body: JSON.stringify({ values: [row.map((c) => c ?? '')] }),
      });
    },

    async deleteRow(sheet, row) {
      if (!cfg.write) throw new UpstreamError('Writes are disabled');
      if (!sheetIds) {
        const meta = await authed(`${API}/${id}?fields=sheets.properties(sheetId,title)`);
        sheetIds = new Map((meta.sheets ?? []).map((s: { properties: { title: string; sheetId: number } }) => [s.properties.title, s.properties.sheetId]));
      }
      const sheetId = sheetIds.get(sheet);
      if (sheetId === undefined) throw new UpstreamError(`Unknown sheet ${sheet}`);
      await authed(`${API}/${id}:batchUpdate`, {
        method: 'POST', headers: json,
        body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row } } }] }),
      });
    },
  };
}
