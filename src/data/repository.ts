import type { DailyAnswer, InboxItem, Person, Project, Task, TaskEvent, TaskPatch } from '../domain/types';

/**
 * Everything the UI persists goes through this interface. There are two
 * implementations (Supabase, and a local demo store); the UI never knows which.
 * TODAY and TASKS share these same task records.
 */
export interface Repository {
  readonly kind: 'supabase' | 'local';
  listTasks(): Promise<Task[]>;
  createTask(task: Task): Promise<void>;
  listProjects(): Promise<Project[]>;
  updateTask(id: string, patch: TaskPatch): Promise<void>;
  /** Makes `id` the only focus task; null clears the focus. */
  setFocus(id: string | null): Promise<void>;
  deleteTask(id: string): Promise<void>;

  listPeople(): Promise<Person[]>;
  createPerson(person: Person): Promise<void>;

  addTaskEvents(events: TaskEvent[]): Promise<void>;
  listTaskEvents(taskId: string): Promise<TaskEvent[]>;

  /** Raw captures that have not been turned into tasks yet. */
  listInbox(): Promise<InboxItem[]>;
  createInboxItem(item: InboxItem): Promise<void>;
  updateInboxItem(id: string, patch: Partial<InboxItem>): Promise<void>;
  deleteInboxItem(id: string): Promise<void>;

  getDailyAnswer(date: string): Promise<DailyAnswer | null>;
  saveDailyAnswer(a: DailyAnswer): Promise<void>;
  listDailyAnswers(limit?: number): Promise<DailyAnswer[]>;
}
