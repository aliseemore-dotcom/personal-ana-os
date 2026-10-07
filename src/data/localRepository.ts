import type { DailyAnswer, InboxItem, Project, Task, TaskPatch } from '../domain/types';
import type { Repository } from './repository';
import { buildSeed } from './seed';

const KEY = 'personal-os:v1';

interface Store {
  tasks: Task[];
  projects: Project[];
  inbox: InboxItem[];
  answers: DailyAnswer[];
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* fall through to a fresh store */
  }
  const { tasks, projects } = buildSeed(new Date());
  return { tasks, projects, inbox: [], answers: [] };
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
      save();
    },
    async createInboxItem(item) {
      store.inbox = [item, ...store.inbox];
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
