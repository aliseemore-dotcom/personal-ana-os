import type { DailyAnswer, InboxItem, Person, Project, Task, TaskEvent, TaskPatch } from '../domain/types';
import { normaliseTask } from '../logic/taskFactory';
import type { Repository } from './repository';
import { buildSeed } from './seed';

const KEY = 'personal-os:v2';

interface Store {
  tasks: Task[];
  projects: Project[];
  people: Person[];
  events: TaskEvent[];
  inbox: InboxItem[];
  answers: DailyAnswer[];
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      return { ...s, tasks: s.tasks.map(normaliseTask) };
    }
  } catch {
    /* fall through to a fresh store */
  }
  return { ...buildSeed(new Date()), answers: [] };
}

/**
 * Demo/offline store in localStorage. It mirrors the Supabase behaviour
 * (single focus, ids, timestamps) so the UI can be developed without a backend.
 */
export function createLocalRepository(): Repository {
  let store = load();
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
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
