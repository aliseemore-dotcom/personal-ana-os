import type { Task } from '../domain/types';

export function newTask(over: Partial<Task> & { title: string }, now: Date): Task {
  const iso = now.toISOString();
  return {
    id: crypto.randomUUID(),
    description: null,
    status: 'inbox',
    priority: 'medium',
    deadline: null,
    scheduled_date: null,
    estimated_duration: null,
    project_id: null,
    created_at: iso,
    updated_at: iso,
    last_activity_at: iso,
    completed_at: null,
    impact_score: 5,
    blocks_others: false,
    blocks_note: null,
    is_focus: false,
    source: 'manual',
    notes: null,
    assigned_person_id: null,
    delegated_to: null,
    waiting_since: null,
    backlog_since: over.status === 'backlog' ? iso : null,
    reschedule_count: 0,
    last_reviewed_at: null,
    workstream_id: null,
    ...over,
  };
}

/** Fill fields that older stored records may lack. */
export function normaliseTask(t: Partial<Task> & Pick<Task, 'id' | 'title'>): Task {
  const base = newTask({ title: t.title }, new Date(t.created_at ?? Date.now()));
  return { ...base, ...t } as Task;
}
