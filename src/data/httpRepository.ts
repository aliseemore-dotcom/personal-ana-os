import type {
  DailyAnswer, InboxItem, Person, Project, ProjectDecision, ProjectDocument, ProjectEvent, ProjectNote, ProjectPatch, ProjectPerson,
  Task, TaskEvent, TaskPatch, Workstream, WorkstreamPatch,
} from '../domain/types';
import { dateKey } from '../domain/dates';
import { nextId } from '../domain/ids';
import { newTask } from '../logic/taskFactory';
import type { Repository, SyncController, SyncStatus } from './repository';

/** What GET /api/data returns: the Data Hub as normalised application objects. */
export interface HubSnapshot {
  tasks: Task[];
  projects: Project[];
  workstreams: Workstream[];
  decisions: ProjectDecision[];
  notes: ProjectNote[];
  dailyQuestions: { id: string; date: string | null; question: string; answer: string | null }[];
}

export class UnauthorisedError extends Error {}

export interface HttpRepositoryOptions {
  getKey: () => string | null;
  onUnauthorised: () => void;
  /** Where things the Data Hub has no sheet for yet are kept (people, documents, history). */
  extras: Repository;
  fetchImpl?: typeof fetch;
  /** A read newer than this is reused, so the providers' parallel loads cost one request. */
  reuseMs?: number;
}

const PREFIX = { task: 'TASK-', workstream: 'WS-', decision: 'DEC-', note: 'NOTE-' } as const;

/**
 * The browser's view of the Data Hub. It talks only to our own /api, never to Google, and implements
 * the same Repository the UI has always used, so TODAY, TASKS and PROJECTS did not have to change.
 */
export function createHttpRepository(opts: HttpRepositoryOptions): Repository {
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const reuseMs = opts.reuseMs ?? 5_000;
  const { extras } = opts;

  let current: { data: HubSnapshot; at: number } | null = null;
  let inflight: Promise<HubSnapshot> | null = null;
  const status: SyncStatus = { syncedAt: null, stale: false, refreshing: false, writable: false };
  const statusListeners = new Set<() => void>();
  const dataListeners = new Set<() => void>();
  const notifyStatus = () => statusListeners.forEach((l) => l());

  const headers = (): Record<string, string> => {
    const key = opts.getKey();
    return key ? { Authorization: `Bearer ${key}` } : {};
  };

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await doFetch(path, { ...init, headers: { ...headers(), ...(init.headers ?? {}) }, credentials: 'same-origin' });
    if (res.status === 401) {
      opts.onUnauthorised();
      throw new UnauthorisedError('Access key required');
    }
    return res;
  }

  async function fetchSnapshot(force: boolean): Promise<HubSnapshot> {
    status.refreshing = true;
    notifyStatus();
    try {
      const res = await request(`/api/data${force ? '?refresh=1' : ''}`);
      if (!res.ok) throw new Error(`data ${res.status}`);
      const body = (await res.json()) as { data: HubSnapshot; syncedAt: string; stale: boolean; writable: boolean };
      current = { data: body.data, at: Date.now() };
      status.syncedAt = body.syncedAt;
      status.stale = body.stale;
      status.writable = body.writable;
      return body.data;
    } catch (e) {
      if (e instanceof UnauthorisedError) throw e;
      // The network or the sheet is down: keep showing the last copy and say so calmly.
      if (current) {
        status.stale = true;
        return current.data;
      }
      throw e;
    } finally {
      status.refreshing = false;
      notifyStatus();
    }
  }

  function snapshot(force = false): Promise<HubSnapshot> {
    if (!force && current && Date.now() - current.at < reuseMs) return Promise.resolve(current.data);
    if (!inflight) inflight = fetchSnapshot(force).finally(() => { inflight = null; });
    return inflight;
  }

  const sync: SyncController = {
    getStatus: () => ({ ...status }),
    subscribe(fn) {
      statusListeners.add(fn);
      return () => void statusListeners.delete(fn);
    },
    onData(fn) {
      dataListeners.add(fn);
      return () => void dataListeners.delete(fn);
    },
    async refresh() {
      await snapshot(true);
      dataListeners.forEach((l) => l());
    },
  };

  async function write(body: Record<string, unknown>): Promise<{ record?: { id?: string }; status: number }> {
    const res = await request('/api/write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const err = new Error(`write ${res.status}`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }
    if (current) current.at = 0; // the next read goes back to the source
    const json = (await res.json().catch(() => ({}))) as { record?: { id?: string } };
    return { record: json.record, status: res.status };
  }

  /** If the source had to pick a different id than we proposed, reload so we show what it really holds. */
  async function created(proposed: string, result: { record?: { id?: string } }) {
    if (result.record?.id && result.record.id !== proposed) setTimeout(() => void sync.refresh().catch(() => undefined), 400);
  }

  /** Deadlines are dates in the sheet. Send the local day, not a UTC instant that could land on the wrong day. */
  const wireTask = <T extends Partial<Task>>(t: T): T => {
    const out: Partial<Task> = { ...t };
    if (typeof out.deadline === 'string') out.deadline = dateKey(new Date(out.deadline));
    return out as T;
  };

  const wireProject = (p: ProjectPatch): ProjectPatch => {
    const { updated_at: _u, ...rest } = p; // the sheet keeps its own, server-side
    void _u;
    return rest;
  };

  return {
    kind: 'sheets',
    sync,
    nextId: (entity, existing) => nextId(existing, PREFIX[entity]),

    async getDailyQuestion(date) {
      return (await snapshot()).dailyQuestions.find((q) => q.date === date && q.question)?.question ?? null;
    },

    /* ----- tasks ----- */
    async listTasks() {
      return (await snapshot()).tasks;
    },
    async createTask(task) {
      const r = await write({ op: 'createTask', task: wireTask(task) });
      await created(task.id, r);
    },
    async updateTask(id, patch: TaskPatch) {
      const { updated_at: _u, ...rest } = patch;
      void _u;
      await write({ op: 'updateTask', id, patch: wireTask(rest) });
    },
    async setFocus(id) {
      await write({ op: 'setFocus', id });
    },
    async deleteTask(id) {
      await write({ op: 'deleteTask', id });
    },

    /* ----- projects and their children ----- */
    async listProjects() {
      return (await snapshot()).projects;
    },
    async updateProject(id, patch) {
      await write({ op: 'updateProject', id, patch: wireProject(patch) });
    },
    async listWorkstreams() {
      return (await snapshot()).workstreams;
    },
    async createWorkstream(w) {
      const r = await write({ op: 'createWorkstream', workstream: { ...w, metadata: undefined } });
      await created(w.id, r);
    },
    async updateWorkstream(id, patch: WorkstreamPatch) {
      const { updated_at: _u, metadata: _m, ...rest } = patch;
      void _u; void _m;
      await write({ op: 'updateWorkstream', id, patch: rest });
    },
    async listDecisions() {
      return (await snapshot()).decisions;
    },
    async createDecision(d) {
      const r = await write({ op: 'createDecision', decision: d });
      await created(d.id, r);
    },
    async deleteDecision() {
      throw new Error('Decisions are kept as a record and are not deleted from the app');
    },
    async listNotes() {
      return (await snapshot()).notes;
    },
    async createNote(n) {
      const r = await write({ op: 'createNote', note: n });
      await created(n.id, r);
    },
    async deleteNote() {
      throw new Error('Notes are not deleted from the app yet');
    },

    /* ----- quick capture: a capture is simply an Inbox task in the Data Hub ----- */
    async listInbox(): Promise<InboxItem[]> {
      return [];
    },
    async createInboxItem(item) {
      const existing = (await snapshot()).tasks.map((t) => t.id);
      const task = newTask({ id: nextId(existing, PREFIX.task), title: item.content, status: 'inbox', source: 'capture', created_at: item.created_at }, new Date(item.created_at));
      const r = await write({ op: 'createTask', task: wireTask(task) });
      await created(task.id, r);
    },
    async updateInboxItem() {},
    async deleteInboxItem() {},

    /* ----- daily answers: the sheet when it has a place for them, otherwise this browser ----- */
    async getDailyAnswer(date) {
      const row = (await snapshot()).dailyQuestions.find((q) => q.date === date && q.answer);
      if (row) return { date, question: row.question, answer: row.answer! };
      return extras.getDailyAnswer(date);
    },
    async saveDailyAnswer(a: DailyAnswer) {
      try {
        await write({ op: 'saveDailyAnswer', ...a });
      } catch (e) {
        if ((e as { status?: number }).status !== 422) throw e;
        await extras.saveDailyAnswer(a);
      }
    },
    listDailyAnswers: (limit) => extras.listDailyAnswers(limit),

    /* ----- things the Data Hub has no sheet for yet: kept in this browser, clearly separate ----- */
    listPeople: () => extras.listPeople(),
    createPerson: (p: Person) => extras.createPerson(p),
    updatePerson: (id, patch) => extras.updatePerson(id, patch),
    addTaskEvents: (e: TaskEvent[]) => extras.addTaskEvents(e),
    listTaskEvents: (id) => extras.listTaskEvents(id),
    listProjectPeople: () => extras.listProjectPeople(),
    saveProjectPerson: (l: ProjectPerson) => extras.saveProjectPerson(l),
    deleteProjectPerson: (id) => extras.deleteProjectPerson(id),
    listProjectEvents: () => extras.listProjectEvents(),
    addProjectEvent: (e: ProjectEvent) => extras.addProjectEvent(e),
    listDocuments: () => extras.listDocuments(),
    createDocument: (d: ProjectDocument) => extras.createDocument(d),
    deleteDocument: (id) => extras.deleteDocument(id),
  };
}
