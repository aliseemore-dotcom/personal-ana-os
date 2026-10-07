import type { Project, Workstream } from '../domain/types';

export function newProject(over: Partial<Project> & Pick<Project, 'id' | 'name' | 'category'>, now: Date): Project {
  const iso = now.toISOString();
  return {
    summary: null,
    objective: null,
    status_note: null,
    status: 'active',
    health: 'on_track',
    next_action: null,
    blocker: null,
    next_milestone: null,
    next_milestone_date: null,
    cover_image: null,
    workstream_kind: 'workstream',
    goal_id: null,
    created_at: iso,
    updated_at: iso,
    last_activity_at: iso,
    ...over,
  };
}

export function newWorkstream(over: Partial<Workstream> & Pick<Workstream, 'project_id' | 'name'>, now: Date): Workstream {
  const iso = now.toISOString();
  return {
    id: crypto.randomUUID(),
    type: 'workstream',
    status: 'active',
    health: 'on_track',
    summary: null,
    next_action: null,
    blocker: null,
    next_milestone: null,
    metadata: {},
    created_at: iso,
    updated_at: iso,
    last_activity_at: iso,
    ...over,
  };
}

/** Fill fields older stored projects may lack (e.g. tasks that pointed at the earlier, simpler Project). */
export function normaliseProject(p: Partial<Project> & Pick<Project, 'id' | 'name'>): Project {
  return newProject({ category: 'work', ...p }, new Date(p.created_at ?? Date.now()));
}
