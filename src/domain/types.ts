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
}

export type TaskPatch = Partial<Omit<Task, 'id' | 'created_at'>>;

export interface Project {
  id: string;
  name: string;
  /** Reserved: projects will roll up into goals later. */
  goal_id: string | null;
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
