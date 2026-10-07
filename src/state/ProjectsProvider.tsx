import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Repository } from '../data';
import type {
  Project, ProjectDecision, ProjectDocument, ProjectEvent, ProjectEventType, ProjectNote, ProjectPatch, ProjectPerson,
  Workstream, WorkstreamKind, WorkstreamPatch,
} from '../domain/types';
import { newWorkstream } from '../logic/projectFactory';
import { t } from '../strings';
import { useTasks } from './TasksProvider';

export interface NewDecision {
  project_id: string;
  workstream_id: string | null;
  date: string;
  decision: string;
  context: string;
  /** Names; each is linked to a shared Person record. */
  people: string[];
}

export interface NewDocument {
  project_id: string;
  workstream_id: string | null;
  name: string;
  type: string;
  url: string;
}

export interface NewLink {
  id?: string;
  project_id: string;
  workstream_id: string | null;
  name: string;
  organisation: string;
  role: string;
  relationship: string;
  last_interaction: string;
  next_action: string;
}

interface ProjectsApi {
  projects: Project[];
  workstreams: Workstream[];
  decisions: ProjectDecision[];
  notes: ProjectNote[];
  documents: ProjectDocument[];
  links: ProjectPerson[];
  events: ProjectEvent[];
  status: 'loading' | 'ready' | 'error';

  updateProject(id: string, patch: ProjectPatch): void;
  reachMilestone(id: string): void;
  addWorkstream(project_id: string, name: string, type: WorkstreamKind, metadata?: Record<string, unknown>): void;
  updateWorkstream(id: string, patch: WorkstreamPatch): void;
  addDecision(d: NewDecision): Promise<void>;
  addNote(project_id: string, workstream_id: string | null, body: string): void;
  deleteNote(id: string): void;
  addDocument(d: NewDocument): void;
  deleteDocument(id: string): void;
  saveLink(l: NewLink): Promise<void>;
  removeLink(id: string): void;
}

const Ctx = createContext<ProjectsApi | null>(null);

const isHttp = (u: string) => /^https?:\/\//i.test(u);
export const safeUrl = (u: string): string | null => {
  const url = u.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
  return isHttp(withScheme) ? withScheme : null;
};

export function ProjectsProvider({ repo, children }: { repo: Repository; children: ReactNode }) {
  const tasks = useTasks();
  const [projects, setProjects] = useState<Project[]>([]);
  const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
  const [decisions, setDecisions] = useState<ProjectDecision[]>([]);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [links, setLinks] = useState<ProjectPerson[]>([]);
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [status, setStatus] = useState<ProjectsApi['status']>('loading');

  const ref = useRef({ projects, workstreams, decisions, notes, documents, links, events });
  ref.current = { projects, workstreams, decisions, notes, documents, links, events };
  const pending = useRef(0);

  const refresh = useCallback(async () => {
    if (pending.current > 0) return;
    try {
      const [p, w, d, n, doc, l, e] = await Promise.all([
        repo.listProjects(), repo.listWorkstreams(), repo.listDecisions(), repo.listNotes(), repo.listDocuments(), repo.listProjectPeople(), repo.listProjectEvents(),
      ]);
      if (pending.current > 0) return;
      setProjects(p); setWorkstreams(w); setDecisions(d); setNotes(n); setDocuments(doc); setLinks(l); setEvents(e);
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(refresh, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  /** Optimistic write over a group of collections: restore them all if saving fails. */
  const run = useCallback(
    (apply: () => void, persist: () => Promise<void>) => {
      const snap = ref.current;
      apply();
      pending.current++;
      persist()
        .catch(() => {
          setProjects(snap.projects); setWorkstreams(snap.workstreams); setDecisions(snap.decisions); setNotes(snap.notes);
          setDocuments(snap.documents); setLinks(snap.links); setEvents(snap.events);
          tasks.notify(t.errors.save);
        })
        .finally(() => {
          pending.current--;
        });
    },
    [tasks],
  );

  const eventOf = (project_id: string, workstream_id: string | null, type: ProjectEventType, title: string | null, ref_id: string | null): ProjectEvent => ({
    id: crypto.randomUUID(), project_id, workstream_id, type, at: new Date().toISOString(), title, ref_id,
  });

  const api = useMemo<ProjectsApi>(() => {
    const touchProject = (id: string, at: string) => setProjects((all) => all.map((p) => (p.id === id ? { ...p, last_activity_at: at } : p)));

    /** A write inside a project: new records, an event, and a fresh "last activity" on the project. */
    const record = (project_id: string, ev: ProjectEvent, apply: () => void, persist: () => Promise<void>) =>
      run(
        () => {
          apply();
          setEvents((e) => [ev, ...e]);
          touchProject(project_id, ev.at);
        },
        async () => {
          await persist();
          await repo.addProjectEvent(ev);
          await repo.updateProject(project_id, { last_activity_at: ev.at });
        },
      );

    return {
      projects, workstreams, decisions, notes, documents, links, events, status,

      updateProject(id, patch) {
        const before = ref.current.projects.find((p) => p.id === id);
        if (!before) return;
        const at = new Date().toISOString();
        const full: ProjectPatch = { ...patch, last_activity_at: at };
        const ev = patch.status && patch.status !== before.status ? eventOf(id, null, 'status_changed', t.projectsPage.statuses[patch.status], null) : null;
        run(
          () => {
            setProjects((all) => all.map((p) => (p.id === id ? { ...p, ...full, updated_at: at } : p)));
            if (ev) setEvents((e) => [ev, ...e]);
          },
          async () => {
            await repo.updateProject(id, full);
            if (ev) await repo.addProjectEvent(ev);
          },
        );
      },

      reachMilestone(id) {
        const p = ref.current.projects.find((x) => x.id === id);
        if (!p?.next_milestone) return;
        const ev = eventOf(id, null, 'milestone_reached', p.next_milestone, null);
        const patch: ProjectPatch = { next_milestone: null, next_milestone_date: null, last_activity_at: ev.at };
        run(
          () => {
            setProjects((all) => all.map((x) => (x.id === id ? { ...x, ...patch } : x)));
            setEvents((e) => [ev, ...e]);
          },
          async () => {
            await repo.updateProject(id, patch);
            await repo.addProjectEvent(ev);
          },
        );
      },

      addWorkstream(project_id, name, type, metadata) {
        const w = newWorkstream({ project_id, name: name.trim(), type, metadata: metadata ?? {} }, new Date());
        record(project_id, eventOf(project_id, w.id, 'workstream_added', w.name, w.id), () => setWorkstreams((all) => [...all, w]), () => repo.createWorkstream(w));
      },

      updateWorkstream(id, patch) {
        const before = ref.current.workstreams.find((w) => w.id === id);
        if (!before) return;
        const at = new Date().toISOString();
        const full: WorkstreamPatch = { ...patch, last_activity_at: at };
        const ev = patch.status && patch.status !== before.status ? eventOf(before.project_id, id, 'status_changed', `${before.name}: ${t.projectsPage.statuses[patch.status]}`, id) : null;
        run(
          () => {
            setWorkstreams((all) => all.map((w) => (w.id === id ? { ...w, ...full, updated_at: at } : w)));
            if (ev) setEvents((e) => [ev, ...e]);
            touchProject(before.project_id, at);
          },
          async () => {
            await repo.updateWorkstream(id, full);
            if (ev) await repo.addProjectEvent(ev);
            await repo.updateProject(before.project_id, { last_activity_at: at });
          },
        );
      },

      async addDecision(d) {
        const ids: string[] = [];
        for (const name of d.people) {
          const id = await tasks.ensurePerson(name);
          if (id) ids.push(id);
        }
        const rec: ProjectDecision = {
          id: crypto.randomUUID(), project_id: d.project_id, workstream_id: d.workstream_id, date: d.date, decision: d.decision.trim(),
          context: d.context.trim() || null, people_ids: ids, created_at: new Date().toISOString(),
        };
        record(d.project_id, eventOf(d.project_id, d.workstream_id, 'decision_recorded', rec.decision, rec.id), () => setDecisions((all) => [rec, ...all]), () => repo.createDecision(rec));
      },

      addNote(project_id, workstream_id, body) {
        const n: ProjectNote = { id: crypto.randomUUID(), project_id, workstream_id, body: body.trim(), created_at: new Date().toISOString() };
        record(project_id, eventOf(project_id, workstream_id, 'note_added', n.body.slice(0, 80), n.id), () => setNotes((all) => [n, ...all]), () => repo.createNote(n));
      },
      deleteNote(id) {
        run(() => setNotes((all) => all.filter((n) => n.id !== id)), () => repo.deleteNote(id));
      },

      addDocument(d) {
        const url = safeUrl(d.url);
        if (!url) return;
        const now = new Date().toISOString();
        const doc: ProjectDocument = { id: crypto.randomUUID(), project_id: d.project_id, workstream_id: d.workstream_id, name: d.name.trim(), type: d.type, url, created_at: now, updated_at: now };
        record(d.project_id, eventOf(d.project_id, d.workstream_id, 'document_added', doc.name, doc.id), () => setDocuments((all) => [doc, ...all]), () => repo.createDocument(doc));
      },
      deleteDocument(id) {
        run(() => setDocuments((all) => all.filter((d) => d.id !== id)), () => repo.deleteDocument(id));
      },

      async saveLink(l) {
        const personId = await tasks.ensurePerson(l.name);
        if (!personId) return;
        if (l.organisation.trim()) tasks.updatePerson(personId, { organisation: l.organisation.trim() });
        const link: ProjectPerson = {
          id: l.id ?? crypto.randomUUID(), project_id: l.project_id, workstream_id: l.workstream_id, person_id: personId,
          role: l.role.trim() || null, relationship: l.relationship.trim() || null, last_interaction: l.last_interaction || null, next_action: l.next_action.trim() || null,
        };
        run(() => setLinks((all) => [...all.filter((x) => x.id !== link.id), link]), () => repo.saveProjectPerson(link));
      },
      removeLink(id) {
        run(() => setLinks((all) => all.filter((x) => x.id !== id)), () => repo.deleteProjectPerson(id));
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, workstreams, decisions, notes, documents, links, events, status, run, repo, tasks.ensurePerson, tasks.updatePerson]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useProjects(): ProjectsApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProjects outside ProjectsProvider');
  return v;
}
