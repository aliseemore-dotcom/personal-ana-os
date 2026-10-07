import type { InboxItem, Priority, Task, TaskStatus } from '../domain/types';
import { calendarDaysBetween, dateKey } from '../domain/dates';
import { classify } from './attention';
import { DEFAULT_THRESHOLDS, type Thresholds } from './thresholds';

export interface Filters {
  query: string;
  project: string;
  status: TaskStatus | '';
  priority: Priority | '';
  deadline: '' | 'today' | 'week' | 'none';
  overdue: boolean;
  waiting: boolean;
  lost: boolean;
  today: boolean;
}

export const EMPTY_FILTERS: Filters = { query: '', project: '', status: '', priority: '', deadline: '', overdue: false, waiting: false, lost: false, today: false };

/** Anything other than the search box. */
export function hasFacets(f: Filters): boolean {
  return Boolean(f.project || f.status || f.priority || f.deadline || f.overdue || f.waiting || f.lost || f.today);
}
export const isFiltering = (f: Filters) => hasFacets(f) || f.query.trim() !== '';

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase();

export function matchesQuery(q: string, ...fields: (string | null | undefined)[]): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = fields.map(norm).join(' ');
  return words.every((w) => hay.includes(w));
}

export function applyFilters(
  tasks: Task[],
  f: Filters,
  now: Date,
  projectName: (id: string | null) => string,
  t: Thresholds = DEFAULT_THRESHOLDS,
): Task[] {
  return tasks.filter((task) => {
    if (f.query.trim() && !matchesQuery(f.query, task.title, task.description, task.notes, task.delegated_to, projectName(task.project_id))) return false;
    if (f.project && (f.project === '__none' ? task.project_id : task.project_id !== f.project)) return false;
    if (f.status && task.status !== f.status) return false;
    if (f.priority && task.priority !== f.priority) return false;
    if (f.deadline) {
      const d = task.deadline ? new Date(task.deadline) : null;
      if (f.deadline === 'none' && d) return false;
      if (f.deadline === 'today' && !(d && calendarDaysBetween(now, d) === 0)) return false;
      if (f.deadline === 'week' && !(d && calendarDaysBetween(now, d) >= 0 && calendarDaysBetween(now, d) <= 7)) return false;
    }
    if (f.overdue || f.waiting || f.lost) {
      const kind = classify(task, now, t)?.kind;
      if (f.overdue && kind !== 'overdue') return false;
      if (f.waiting && kind !== 'waiting') return false;
      if (f.lost && kind !== 'lost_attention') return false;
    }
    if (f.today && !(task.status !== 'done' && task.scheduled_date === dateKey(now))) return false;
    return true;
  });
}

/** Raw captures only respond to the search box and the Inbox status. */
export function filterCaptures(captures: InboxItem[], f: Filters): InboxItem[] {
  if (f.project || f.priority || f.deadline || f.overdue || f.waiting || f.lost || f.today) return [];
  if (f.status && f.status !== 'inbox') return [];
  return captures.filter((c) => c.status === 'inbox' && (!f.query.trim() || matchesQuery(f.query, c.content)));
}
