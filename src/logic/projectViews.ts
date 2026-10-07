import type { Project, ProjectCategory, ProjectDecision, ProjectEvent, ProjectNote, ProjectStatus, Task, Health, Workstream } from '../domain/types';
import { dateKey } from '../domain/dates';
import { matchesQuery } from './filters';
import type { ProjectAssessment, Signal } from './projectHealth';

/** A project together with what the data says about it. */
export interface ProjectView {
  project: Project;
  tasks: Task[];
  workstreams: Workstream[];
  assessment: ProjectAssessment;
}

export interface ProjectFilters {
  category: ProjectCategory | '';
  status: ProjectStatus | '';
  health: Health | '';
  query: string;
}
export const EMPTY_PROJECT_FILTERS: ProjectFilters = { category: '', status: '', health: '', query: '' };

export function filterProjects(views: ProjectView[], f: ProjectFilters): ProjectView[] {
  return views.filter(({ project: p, workstreams, assessment }) => {
    if (f.category && p.category !== f.category) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.health && assessment.health !== f.health) return false;
    if (f.query.trim() && !matchesQuery(f.query, p.name, p.summary, p.objective, ...workstreams.map((w) => w.name))) return false;
    return true;
  });
}

const STATUS_ORDER: Record<ProjectStatus, number> = { active: 0, waiting: 1, on_hold: 2, completed: 3 };
const HEALTH_ORDER: Record<Health, number> = { blocked: 0, needs_attention: 1, on_track: 2 };

/** Completed last; before that, the ones that need a look first, then by status. Stable otherwise. */
export function sortProjects(views: ProjectView[]): ProjectView[] {
  const finished = (v: ProjectView) => (v.project.status === 'completed' ? 1 : 0);
  return [...views].sort(
    (a, b) =>
      finished(a) - finished(b) ||
      HEALTH_ORDER[a.assessment.health] - HEALTH_ORDER[b.assessment.health] ||
      STATUS_ORDER[a.project.status] - STATUS_ORDER[b.project.status],
  );
}

export type TaskView = 'current' | 'upcoming' | 'waiting' | 'completed';

export function splitTasks(tasks: Task[], now: Date): Record<TaskView, Task[]> {
  const today = dateKey(now);
  const out: Record<TaskView, Task[]> = { current: [], upcoming: [], waiting: [], completed: [] };
  for (const t of tasks) {
    if (t.status === 'done') out.completed.push(t);
    else if (t.status === 'waiting') out.waiting.push(t);
    else if (t.status === 'backlog' || (t.scheduled_date && t.scheduled_date > today)) out.upcoming.push(t);
    else out.current.push(t);
  }
  out.completed.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
  out.upcoming.sort((a, b) => (a.scheduled_date ?? '9').localeCompare(b.scheduled_date ?? '9'));
  return out;
}

export interface TimelineRecords {
  project: Project;
  workstreams: Workstream[];
  decisions: ProjectDecision[];
  notes: ProjectNote[];
}

const DERIVED: ProjectEvent['type'][] = ['project_created', 'workstream_added', 'decision_recorded', 'note_added'];

/**
 * Timeline = stored project events + task completions read straight from the tasks,
 * so completing a task anywhere never needs a second write.
 * When the records themselves are given (the Data Hub case), project creation, workstreams,
 * decisions and notes are read from them too, so a decision someone wrote straight into the
 * sheet shows up, and a stored duplicate of the same event is ignored.
 */
export function buildTimeline(events: ProjectEvent[], tasks: Task[], projectId: string, workstreamId: string | null, records?: TimelineRecords): ProjectEvent[] {
  const fromRecords: ProjectEvent[] = records
    ? [
        { id: `created-${records.project.id}`, project_id: projectId, workstream_id: null, type: 'project_created', at: records.project.created_at, title: records.project.name, ref_id: null },
        ...records.workstreams.map<ProjectEvent>((w) => ({ id: `ws-${w.id}`, project_id: projectId, workstream_id: w.id, type: 'workstream_added', at: w.created_at, title: w.name, ref_id: w.id })),
        ...records.decisions.filter((d) => d.project_id === projectId).map<ProjectEvent>((d) => ({ id: `dec-${d.id}`, project_id: projectId, workstream_id: d.workstream_id, type: 'decision_recorded', at: d.created_at, title: d.decision, ref_id: d.id })),
        ...records.notes.filter((n) => n.project_id === projectId).map<ProjectEvent>((n) => ({ id: `note-${n.id}`, project_id: projectId, workstream_id: n.workstream_id, type: 'note_added', at: n.created_at, title: n.body.slice(0, 80), ref_id: n.id })),
      ]
    : [];
  const stored = records ? events.filter((e) => !DERIVED.includes(e.type)) : events;
  const derived: ProjectEvent[] = tasks
    .filter((t) => t.status === 'done' && t.completed_at && t.project_id === projectId)
    .map((t) => ({ id: `done-${t.id}`, project_id: projectId, workstream_id: t.workstream_id, type: 'task_completed', at: t.completed_at!, title: t.title, ref_id: t.id }));
  return [...stored.filter((e) => e.project_id === projectId), ...fromRecords, ...derived]
    .filter((e) => !workstreamId || e.workstream_id === workstreamId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export type { Signal };
