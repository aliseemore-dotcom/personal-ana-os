import type { DailyAnswer, InboxItem, Project, Task, TaskPatch } from '../domain/types';

/**
 * Everything the UI persists goes through this interface. There are two
 * implementations (Supabase, and a local demo store); the UI never knows which.
 */
export interface Repository {
  readonly kind: 'supabase' | 'local';
  listTasks(): Promise<Task[]>;
  listProjects(): Promise<Project[]>;
  updateTask(id: string, patch: TaskPatch): Promise<void>;
  /** Makes `id` the only focus task; null clears the focus. */
  setFocus(id: string | null): Promise<void>;
  deleteTask(id: string): Promise<void>;

  createInboxItem(item: InboxItem): Promise<void>;

  getDailyAnswer(date: string): Promise<DailyAnswer | null>;
  saveDailyAnswer(a: DailyAnswer): Promise<void>;
  listDailyAnswers(limit?: number): Promise<DailyAnswer[]>;
}
