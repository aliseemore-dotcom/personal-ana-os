import { createHash, timingSafeEqual } from 'node:crypto';
import type { ProjectDecision, ProjectNote, Task, Workstream } from '../src/domain/types.js';
import { createSheetsHub, HubError, type DataHub } from './hub.js';
import { ConfigError, createGoogleSheetsClient, googleConfigFromEnv } from './sheets/client.js';

type Env = Record<string, string | undefined>;

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  // Private data: never stored by a shared cache.
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const MAX_BODY = 64 * 1024;

/**
 * The dashboard holds private information, so the API never answers without the access key.
 * If the key is not configured the API refuses everyone rather than opening up.
 */
export function authorise(req: Request, env: Env): Response | null {
  const expected = env.DASHBOARD_ACCESS_KEY?.trim();
  if (!expected) return reply(503, { error: 'not_configured' });
  const given = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1] ?? '';
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b) ? null : reply(401, { error: 'unauthorised' });
}

let singleton: DataHub | null = null;

/** The hub for this deployment, built from environment variables (never from client input). */
export function hubFromEnv(env: Env = process.env): DataHub {
  if (singleton) return singleton;
  const cfg = googleConfigFromEnv(env);
  singleton = createSheetsHub(createGoogleSheetsClient(cfg), {
    writable: cfg.write,
    ttlMs: Math.max(5, Number(env.SHEETS_CACHE_SECONDS ?? 30)) * 1000,
  });
  return singleton;
}

function failure(e: unknown): Response {
  if (e instanceof HubError) {
    const status = e.code === 'not_found' ? 404 : e.code === 'read_only' ? 403 : e.code === 'invalid' ? 400 : 422;
    return reply(status, { error: e.code, message: e.message });
  }
  if (e instanceof ConfigError) {
    console.error('[data hub] configuration', e.message);
    return reply(503, { error: 'not_configured' });
  }
  // Technical detail stays in the server log; the browser gets a calm, generic error.
  console.error('[data hub] upstream error', (e as Error)?.message);
  return reply(502, { error: 'upstream' });
}

export async function handleData(req: Request, env: Env = process.env, hub?: DataHub): Promise<Response> {
  const denied = authorise(req, env);
  if (denied) return denied;
  try {
    const h = hub ?? hubFromEnv(env);
    const force = new URL(req.url).searchParams.get('refresh') === '1';
    const { snapshot, syncedAt, stale } = await h.getSnapshot({ force });
    return reply(200, { data: snapshot, syncedAt, stale, writable: h.writable });
  } catch (e) {
    return failure(e);
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, name: string) => {
  if (typeof v !== 'string' || !v.trim() || v.length > 200) throw new HubError('invalid', `${name} is required`);
  return v;
};
const obj = (v: unknown, name: string): Obj => {
  if (!isObj(v)) throw new HubError('invalid', `${name} must be an object`);
  return v;
};

export async function handleWrite(req: Request, env: Env = process.env, hub?: DataHub): Promise<Response> {
  const denied = authorise(req, env);
  if (denied) return denied;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) throw new HubError('invalid', 'Request too large');
    let body: Obj;
    try {
      body = obj(JSON.parse(text), 'body');
    } catch (e) {
      if (e instanceof HubError) throw e;
      throw new HubError('invalid', 'Body must be JSON');
    }
    const h = hub ?? hubFromEnv(env);
    switch (body.op) {
      case 'createTask': return reply(200, { ok: true, record: await h.createTask(obj(body.task, 'task') as unknown as Task) });
      case 'updateTask': return reply(200, { ok: true, record: await h.updateTask(str(body.id, 'id'), obj(body.patch, 'patch')) });
      case 'deleteTask': await h.deleteTask(str(body.id, 'id')); return reply(200, { ok: true });
      case 'setFocus': await h.setFocus(body.id === null ? null : str(body.id, 'id')); return reply(200, { ok: true });
      case 'updateProject': return reply(200, { ok: true, record: await h.updateProject(str(body.id, 'id'), obj(body.patch, 'patch')) });
      case 'createWorkstream': return reply(200, { ok: true, record: await h.createWorkstream(obj(body.workstream, 'workstream') as unknown as Workstream) });
      case 'updateWorkstream': return reply(200, { ok: true, record: await h.updateWorkstream(str(body.id, 'id'), obj(body.patch, 'patch')) });
      case 'createDecision': return reply(200, { ok: true, record: await h.createDecision(obj(body.decision, 'decision') as unknown as ProjectDecision) });
      case 'createNote': return reply(200, { ok: true, record: await h.createNote(obj(body.note, 'note') as unknown as ProjectNote) });
      case 'saveDailyAnswer': await h.saveDailyAnswer(str(body.date, 'date'), str(body.question, 'question'), str(body.answer, 'answer')); return reply(200, { ok: true });
      default: throw new HubError('invalid', 'Unknown operation');
    }
  } catch (e) {
    return failure(e);
  }
}
