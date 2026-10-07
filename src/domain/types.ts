export type TaskStatus = 'inbox' | 'backlog' | 'planned' | 'in_progress' | 'waiting' | 'done';
export type Priority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  /** ISO timestamp. Date-only deadlines are stored as end of that local day. */
  deadline: string | null;
  /** Local calendar day, YYYY-MM-DD. */
  scheduled_date: string | null;
  /** Minutes. */
  estimated_duration: number | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  completed_at: string | null;
  /** 1–10 */
  impact_score: number;
  blocks_others: boolean;
  /** Human reason shown in the Focus card, e.g. "Investor waiting". */
  blocks_note: string | null;
  is_focus: boolean;
  source: string;
  notes: string | null;
  /** Related person (people table). */
  assigned_person_id: string | null;
  /** Name of who the task was handed to. */
  delegated_to: string | null;
  waiting_since: string | null;
  backlog_since: string | null;
  /** How many times the planned date was pushed later. */
  reschedule_count: number;
  /** Last time a decision was made on this task (Keep, Follow up). */
  last_reviewed_at: string | null;
  /** Optional child of the project: an opportunity, location, trip or workstream. */
  workstream_id: string | null;
}

export type TaskPatch = Partial<Omit<Task, 'id' | 'created_at'>>;

export type ProjectCategory = 'work' | 'business' | 'personal';
export type ProjectStatus = 'active' | 'waiting' | 'on_hold' | 'completed';
export type Health = 'on_track' | 'needs_attention' | 'blocked';
export type WorkstreamKind = 'workstream' | 'opportunity' | 'location' | 'trip';

/** Top-level project. Status is the operational state; health is assessed separately. */
export interface Project {
  id: string;
  name: string;
  category: ProjectCategory;
  /** 2–4 sentences, readable by a person or an assistant. */
  summary: string | null;
  objective: string | null;
  /** The "current status" line shown in the executive brief. */
  status_note: string | null;
  status: ProjectStatus;
  /** Manual health set by the user; the shown health also reflects signals from the data. */
  health: Health;
  next_action: string | null;
  blocker: string | null;
  next_milestone: string | null;
  /** Local day, YYYY-MM-DD; lets an overdue milestone be noticed. */
  next_milestone_date: string | null;
  /** Reserved for project imagery; v1 uses a branded placeholder. */
  cover_image: string | null;
  /** What this project's children are called: opportunities, locations, trips… */
  workstream_kind: WorkstreamKind;
  /** Reserved: projects will roll up into goals later. */
  goal_id: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
}

export type ProjectPatch = Partial<Omit<Project, 'id' | 'created_at'>>;

/** Child of a project (opportunity, location, trip, workstream). Specialist fields go in `metadata`. */
export interface Workstream {
  id: string;
  project_id: string;
  name: string;
  type: WorkstreamKind;
  status: ProjectStatus;
  health: Health;
  summary: string | null;
  next_action: string | null;
  blocker: string | null;
  next_milestone: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
}

export type WorkstreamPatch = Partial<Omit<Workstream, 'id' | 'project_id' | 'created_at'>>;

export interface ProjectDecision {
  id: string;
  project_id: string;
  workstream_id: string | null;
  /** Local day, YYYY-MM-DD. */
  date: string;
  decision: string;
  context: string | null;
  people_ids: string[];
  created_at: string;
}

export interface ProjectNote {
  id: string;
  project_id: string;
  workstream_id: string | null;
  body: string;
  created_at: string;
}

/** A reference to a document that lives elsewhere (e.g. Google Drive); never the file itself. */
export interface ProjectDocument {
  id: string;
  project_id: string;
  workstream_id: string | null;
  name: string;
  type: string;
  url: string;
  created_at: string;
  updated_at: string;
}

/** One Person can be linked to many projects; the relationship lives on the link. */
export interface ProjectPerson {
  id: string;
  project_id: string;
  workstream_id: string | null;
  person_id: string;
  role: string | null;
  relationship: string | null;
  last_interaction: string | null;
  next_action: string | null;
}

export type ProjectEventType =
  | 'project_created'
  | 'status_changed'
  | 'task_completed'
  | 'decision_recorded'
  | 'document_added'
  | 'milestone_reached'
  | 'workstream_added'
  | 'note_added';

export interface ProjectEvent {
  id: string;
  project_id: string;
  workstream_id: string | null;
  type: ProjectEventType;
  at: string;
  /** Short human text, e.g. the decision or task title. */
  title: string | null;
  ref_id: string | null;
}

export interface InboxItem {
  id: string;
  content: string;
  created_at: string;
  status: 'inbox' | 'processed';
  /** Set once the capture has been turned into a task. */
  task_id?: string | null;
}

export interface Person {
  id: string;
  name: string;
  organisation?: string | null;
}

export type TaskEventType =
  | 'created'
  | 'status_changed'
  | 'deadline_changed'
  | 'scheduled'
  | 'rescheduled'
  | 'moved_to_today'
  | 'completed'
  | 'reopened'
  | 'delegated'
  | 'priority_changed'
  | 'reviewed';

/** Append-only activity record; kept apart from the Task so patterns (e.g. repeated postponement) can be mined later. */
export interface TaskEvent {
  id: string;
  task_id: string;
  type: TaskEventType;
  at: string;
  from: string | null;
  to: string | null;
}

export interface DailyAnswer {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  question: string;
  answer: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location?: string | null;
}
