import type {
  DailyAnswer, InboxItem, Person, Project, ProjectDecision, ProjectDocument, ProjectEvent, ProjectNote, ProjectPatch, ProjectPerson,
  Task, TaskEvent, TaskPatch, Workstream, WorkstreamPatch,
} from '../domain/types';

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

  updateProject(id: string, patch: ProjectPatch): Promise<void>;
  listWorkstreams(): Promise<Workstream[]>;
  createWorkstream(w: Workstream): Promise<void>;
  updateWorkstream(id: string, patch: WorkstreamPatch): Promise<void>;
  listDecisions(): Promise<ProjectDecision[]>;
  createDecision(d: ProjectDecision): Promise<void>;
  deleteDecision(id: string): Promise<void>;
  listNotes(): Promise<ProjectNote[]>;
  createNote(n: ProjectNote): Promise<void>;
  deleteNote(id: string): Promise<void>;
  listDocuments(): Promise<ProjectDocument[]>;
  createDocument(d: ProjectDocument): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  listProjectPeople(): Promise<ProjectPerson[]>;
  saveProjectPerson(link: ProjectPerson): Promise<void>;
  deleteProjectPerson(id: string): Promise<void>;
  listProjectEvents(): Promise<ProjectEvent[]>;
  addProjectEvent(e: ProjectEvent): Promise<void>;

  listPeople(): Promise<Person[]>;
  createPerson(person: Person): Promise<void>;
  updatePerson(id: string, patch: Partial<Person>): Promise<void>;

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
