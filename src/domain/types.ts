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
  status: 'inbox';
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
