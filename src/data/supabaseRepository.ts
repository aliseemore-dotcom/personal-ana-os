import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DailyAnswer, InboxItem, Person, Project, ProjectDecision, ProjectDocument, ProjectEvent, ProjectNote, ProjectPatch, ProjectPerson,
  Task, TaskEvent, TaskPatch, Workstream, WorkstreamPatch,
} from '../domain/types';
import { normaliseProject } from '../logic/projectFactory';
import { normaliseTask } from '../logic/taskFactory';
import type { Repository } from './repository';

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export function createSupabaseRepository(db: SupabaseClient): Repository {
  return {
    kind: 'supabase',

    async listTasks() {
      const { data, error } = await db.from('tasks').select('*');
      fail(error);
      return (data ?? []).map((r) => normaliseTask(r as Task));
    },

    async createTask(task) {
      const { error } = await db.from('tasks').insert(task);
      fail(error);
    },

    async listPeople() {
      const { data, error } = await db.from('people').select('id,name,organisation');
      fail(error);
      return (data ?? []) as Person[];
    },

    async createPerson(person) {
      const { error } = await db.from('people').insert(person);
      fail(error);
    },

    async addTaskEvents(events: TaskEvent[]) {
      const { error } = await db.from('task_events').insert(events);
      fail(error);
    },

    async listTaskEvents(taskId) {
      const { data, error } = await db.from('task_events').select('id,task_id,type,at,from,to').eq('task_id', taskId).order('at', { ascending: false });
      fail(error);
      return (data ?? []) as TaskEvent[];
    },

    async listInbox() {
      const { data, error } = await db.from('inbox_items').select('id,content,created_at,status,task_id').eq('status', 'inbox').order('created_at', { ascending: false });
      fail(error);
      return (data ?? []) as InboxItem[];
    },

    async updateInboxItem(id, patch) {
      const { error } = await db.from('inbox_items').update(patch).eq('id', id);
      fail(error);
    },

    async deleteInboxItem(id) {
      const { error } = await db.from('inbox_items').delete().eq('id', id);
      fail(error);
    },

    async listProjects() {
      const { data, error } = await db.from('projects').select('*');
      fail(error);
      return (data ?? []).map((r) => normaliseProject(r as Project));
    },

    async updateProject(id: string, patch: ProjectPatch) {
      const { error } = await db.from('projects').update(patch).eq('id', id);
      fail(error);
    },

    async listWorkstreams() {
      const { data, error } = await db.from('workstreams').select('*');
      fail(error);
      return (data ?? []) as Workstream[];
    },
    async createWorkstream(w: Workstream) {
      const { error } = await db.from('workstreams').insert(w);
      fail(error);
    },
    async updateWorkstream(id: string, patch: WorkstreamPatch) {
      const { error } = await db.from('workstreams').update(patch).eq('id', id);
      fail(error);
    },

    async listDecisions() {
      const { data, error } = await db.from('project_decisions').select('*').order('date', { ascending: false });
      fail(error);
      return (data ?? []) as ProjectDecision[];
    },
    async createDecision(d: ProjectDecision) {
      const { error } = await db.from('project_decisions').insert(d);
      fail(error);
    },
    async deleteDecision(id: string) {
      const { error } = await db.from('project_decisions').delete().eq('id', id);
      fail(error);
    },

    async listNotes() {
      const { data, error } = await db.from('project_notes').select('*').order('created_at', { ascending: false });
      fail(error);
      return (data ?? []) as ProjectNote[];
    },
    async createNote(n: ProjectNote) {
      const { error } = await db.from('project_notes').insert(n);
      fail(error);
    },
    async deleteNote(id: string) {
      const { error } = await db.from('project_notes').delete().eq('id', id);
      fail(error);
    },

    async listDocuments() {
      const { data, error } = await db.from('project_documents').select('*').order('created_at', { ascending: false });
      fail(error);
      return (data ?? []) as ProjectDocument[];
    },
    async createDocument(d: ProjectDocument) {
      const { error } = await db.from('project_documents').insert(d);
      fail(error);
    },
    async deleteDocument(id: string) {
      const { error } = await db.from('project_documents').delete().eq('id', id);
      fail(error);
    },

    async listProjectPeople() {
      const { data, error } = await db.from('project_people').select('*');
      fail(error);
      return (data ?? []) as ProjectPerson[];
    },
    async saveProjectPerson(link: ProjectPerson) {
      const { error } = await db.from('project_people').upsert(link);
      fail(error);
    },
    async deleteProjectPerson(id: string) {
      const { error } = await db.from('project_people').delete().eq('id', id);
      fail(error);
    },

    async listProjectEvents() {
      const { data, error } = await db.from('project_events').select('*').order('at', { ascending: false });
      fail(error);
      return (data ?? []) as ProjectEvent[];
    },
    async addProjectEvent(e: ProjectEvent) {
      const { error } = await db.from('project_events').insert(e);
      fail(error);
    },

    async updatePerson(id: string, patch: Partial<Person>) {
      const { error } = await db.from('people').update(patch).eq('id', id);
      fail(error);
    },

    async updateTask(id: string, patch: TaskPatch) {
      const { is_focus: _focus, ...rest } = patch;
      void _focus; // focus changes go through set_focus() to keep the one-focus rule atomic
      if (Object.keys(rest).length) {
        const { error } = await db.from('tasks').update(rest).eq('id', id);
        fail(error);
      }
      if (patch.is_focus === false) {
        const { error } = await db.from('tasks').update({ is_focus: false }).eq('id', id);
        fail(error);
      }
    },

    async setFocus(id) {
      const { error } = await db.rpc('set_focus', { task_id: id });
      fail(error);
    },

    async deleteTask(id) {
      const { error } = await db.from('tasks').delete().eq('id', id);
      fail(error);
    },

    async createInboxItem(item: InboxItem) {
      const { error } = await db.from('inbox_items').insert(item);
      fail(error);
    },

    async getDailyAnswer(date) {
      const { data, error } = await db.from('daily_answers').select('date,question,answer').eq('date', date).maybeSingle();
      fail(error);
      return (data as DailyAnswer | null) ?? null;
    },

    async saveDailyAnswer(a) {
      const { error } = await db.from('daily_answers').upsert(a, { onConflict: 'user_id,date' });
      fail(error);
    },

    async listDailyAnswers(limit = 365) {
      const { data, error } = await db
        .from('daily_answers')
        .select('date,question,answer')
        .order('date', { ascending: false })
        .limit(limit);
      fail(error);
      return (data ?? []) as DailyAnswer[];
    },
  };
}
