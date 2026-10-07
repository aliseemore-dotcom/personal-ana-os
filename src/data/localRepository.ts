import type {
  DailyAnswer, InboxItem, Person, Project, ProjectDecision, ProjectDocument, ProjectEvent, ProjectNote, ProjectPatch, ProjectPerson,
  Task, TaskEvent, TaskPatch, Workstream, WorkstreamPatch,
} from '../domain/types';
import { normaliseProject } from '../logic/projectFactory';
import { normaliseTask } from '../logic/taskFactory';
import type { Repository } from './repository';
import { buildSeed } from './seed';

const DEMO_KEY = 'personal-os:v3';
const AUX_KEY = 'personal-os:local-extras:v1';

interface Store {
  tasks: Task[];
  projects: Project[];
  people: Person[];
  events: TaskEvent[];
  inbox: InboxItem[];
  answers: DailyAnswer[];
  workstreams: Workstream[];
  decisions: ProjectDecision[];
  notes: ProjectNote[];
  documents: ProjectDocument[];
  projectPeople: ProjectPerson[];
  projectEvents: ProjectEvent[];
}

const emptyStore = (): Store => ({
  tasks: [], projects: [], people: [], events: [], inbox: [], answers: [], workstreams: [], decisions: [], notes: [], documents: [], projectPeople: [], projectEvents: [],
});

function load(key: string, seed: boolean): Store {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      return { ...s, tasks: s.tasks.map(normaliseTask), projects: s.projects.map(normaliseProject) };
    }
  } catch {
    /* fall through to a fresh store */
  }
  return seed ? { ...buildSeed(new Date()), answers: [] } : emptyStore();
}

/**
 * Demo/offline store in localStorage. It mirrors the Supabase behaviour
 * (single focus, ids, timestamps) so the UI can be developed without a backend.
 */
export function createLocalRepository(opts: { demo?: boolean } = {}): Repository {
  const demo = opts.demo ?? true;
  const key = demo ? DEMO_KEY : AUX_KEY;
  let store = load(key, demo);
  const save = () => {
    try {
      localStorage.setItem(key, JSON.stringify(store));
    } catch {
      /* private mode / quota: keep working in memory */
    }
  };

  return {
    kind: 'local',
    async listTasks() {
      return store.tasks.map((t) => ({ ...t }));
    },
    async createTask(task) {
      store.tasks = [...store.tasks, task];
      save();
    },
    async listProjects() {
      return store.projects.map((p) => ({ ...p }));
    },
    async updateTask(id, patch: TaskPatch) {
      store.tasks = store.tasks.map((t) => (t.id === id ? { ...t, ...patch, updated_at: new Date().toISOString() } : t));
      save();
    },
    async setFocus(id) {
      store.tasks = store.tasks.map((t) => ({ ...t, is_focus: t.id === id }));
      save();
    },
    async deleteTask(id) {
      store.tasks = store.tasks.filter((t) => t.id !== id);
      store.events = store.events.filter((e) => e.task_id !== id);
      save();
    },
    async updateProject(id, patch: ProjectPatch) {
      store.projects = store.projects.map((p) => (p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p));
      save();
    },
    async listWorkstreams() {
      return store.workstreams.map((w) => ({ ...w }));
    },
    async createWorkstream(w) {
      store.workstreams = [...store.workstreams, w];
      save();
    },
    async updateWorkstream(id, patch: WorkstreamPatch) {
      store.workstreams = store.workstreams.map((w) => (w.id === id ? { ...w, ...patch, updated_at: new Date().toISOString() } : w));
      save();
    },
    async listDecisions() {
      return [...store.decisions];
    },
    async createDecision(d) {
      store.decisions = [d, ...store.decisions];
      save();
    },
    async deleteDecision(id) {
      store.decisions = store.decisions.filter((x) => x.id !== id);
      save();
    },
    async listNotes() {
      return [...store.notes];
    },
    async createNote(n) {
      store.notes = [n, ...store.notes];
      save();
    },
    async deleteNote(id) {
      store.notes = store.notes.filter((x) => x.id !== id);
      save();
    },
    async listDocuments() {
      return [...store.documents];
    },
    async createDocument(d) {
      store.documents = [d, ...store.documents];
      save();
    },
    async deleteDocument(id) {
      store.documents = store.documents.filter((x) => x.id !== id);
      save();
    },
    async listProjectPeople() {
      return [...store.projectPeople];
    },
    async saveProjectPerson(link) {
      store.projectPeople = [...store.projectPeople.filter((x) => x.id !== link.id), link];
      save();
    },
    async deleteProjectPerson(id) {
      store.projectPeople = store.projectPeople.filter((x) => x.id !== id);
      save();
    },
    async listProjectEvents() {
      return [...store.projectEvents];
    },
    async addProjectEvent(e) {
      store.projectEvents = [e, ...store.projectEvents];
      save();
    },
    async updatePerson(id, patch) {
      store.people = store.people.map((p) => (p.id === id ? { ...p, ...patch } : p));
      save();
    },
    async listPeople() {
      return store.people.map((p) => ({ ...p }));
    },
    async createPerson(person) {
      store.people = [...store.people, person];
      save();
    },
    async addTaskEvents(events) {
      store.events = [...events, ...store.events];
      save();
    },
    async listTaskEvents(taskId) {
      return store.events.filter((e) => e.task_id === taskId).sort((a, b) => b.at.localeCompare(a.at));
    },
    async listInbox() {
      return store.inbox.filter((i) => i.status === 'inbox').sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async createInboxItem(item) {
      store.inbox = [item, ...store.inbox];
      save();
    },
    async updateInboxItem(id, patch) {
      store.inbox = store.inbox.map((i) => (i.id === id ? { ...i, ...patch } : i));
      save();
    },
    async deleteInboxItem(id) {
      store.inbox = store.inbox.filter((i) => i.id !== id);
      save();
    },
    async getDailyAnswer(date) {
      return store.answers.find((a) => a.date === date) ?? null;
    },
    async saveDailyAnswer(a) {
      store.answers = [a, ...store.answers.filter((x) => x.date !== a.date)];
      save();
    },
    async listDailyAnswers(limit = 365) {
      return [...store.answers].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
    },
  };
}
