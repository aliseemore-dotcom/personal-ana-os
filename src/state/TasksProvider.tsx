import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Repository } from '../data';
import type { InboxItem, Person, Project, Task, TaskEvent, TaskPatch, TaskStatus } from '../domain/types';
import { applyChange } from '../logic/bookkeeping';
import {
  backlogPatch, completePatch, delegatePatch, followUpPatch, pausePatch, reopenPatch, reschedulePatch, reviewPatch, statusPatch, waitPatch,
} from '../logic/taskActions';
import { newTask } from '../logic/taskFactory';
import type { Linger } from '../logic/todayModel';
import { t } from '../strings';

const LINGER_MS = 2200;

export interface NewTaskInput {
  title: string;
  project_id?: string | null;
  deadline?: string | null;
  priority?: Task['priority'];
  status?: TaskStatus;
  workstream_id?: string | null;
  scheduled_date?: string | null;
}

interface TasksApi {
  tasks: Task[];
  captures: InboxItem[];
  projects: Map<string, Project>;
  people: Person[];
  status: 'loading' | 'ready' | 'error';
  linger: Linger;
  toast: string | null;

  complete(id: string): void;
  undoComplete(id: string): void;
  reschedule(id: string, day: Date): void;
  scheduleToday(id: string): void;
  setPriority(id: string, p: Task['priority']): void;
  setFocus(id: string): void;
  setStatus(id: string, to: TaskStatus): void;
  moveToBacklog(id: string): void;
  pause(id: string): void;
  wait(id: string): void;
  delegate(id: string, name: string): void;
  followUp(id: string): void;
  /** Keep / Keep waiting / Keep in backlog: a decision, no change. */
  review(id: string): void;
  remove(id: string): void;
  edit(id: string, patch: TaskPatch): void;
  addTask(input: NewTaskInput): void;

  capture(content: string): void;
  /** Turns a capture into a task (in `patch.status`, Planned by default). */
  promoteCapture(id: string, patch?: Partial<Task>): void;
  dropCapture(id: string): void;

  ensurePerson(name: string): Promise<string | null>;
  updatePerson(id: string, patch: Partial<Person>): void;
  loadEvents(taskId: string): Promise<TaskEvent[]>;
  notify(message: string): void;
}

const Ctx = createContext<TasksApi | null>(null);

export function TasksProvider({ repo, children }: { repo: Repository; children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [captures, setCaptures] = useState<InboxItem[]>([]);
  const [projects, setProjects] = useState<Map<string, Project>>(new Map());
  const [people, setPeople] = useState<Person[]>([]);
  const [status, setStatus] = useState<TasksApi['status']>('loading');
  const [lingerIds, setLingerIds] = useState<ReadonlySet<string>>(new Set());
  const [lingerFocus, setLingerFocus] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const capturesRef = useRef(captures);
  capturesRef.current = captures;
  const peopleRef = useRef(people);
  peopleRef.current = people;
  const pending = useRef(0);
  const prevStatus = useRef(new Map<string, TaskStatus>());
  const timers = useRef(new Map<string, number>());
  const toastTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    if (pending.current > 0) return; // don't overwrite optimistic changes still in flight
    try {
      const [ts, ps, cs, pe] = await Promise.all([repo.listTasks(), repo.listProjects(), repo.listInbox(), repo.listPeople()]);
      if (pending.current > 0) return;
      setTasks(ts);
      setProjects(new Map(ps.map((p) => [p.id, p])));
      setCaptures(cs);
      setPeople(pe);
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

  /** Optimistic write: apply now, persist in the background, roll back on failure. */
  const mutate = useCallback(
    (apply: () => void, rollback: () => void, persist: () => Promise<void>) => {
      apply();
      pending.current++;
      persist()
        .catch(() => {
          rollback();
          notify(t.errors.save);
        })
        .finally(() => {
          pending.current--;
        });
    },
    [notify],
  );

  const eventsFor = (taskId: string, evs: ReturnType<typeof applyChange>['events']): TaskEvent[] =>
    evs.map((e) => ({ ...e, id: crypto.randomUUID(), task_id: taskId }));

  /** Every task change goes through here: bookkeeping fields and history come for free. */
  const commit = useCallback(
    (id: string, patch: TaskPatch) => {
      const before = tasksRef.current.find((x) => x.id === id);
      if (!before) return;
      const now = new Date();
      const { patch: full, events } = applyChange(before, patch, now);
      const snapshot = tasksRef.current;
      mutate(
        () => setTasks((all) => all.map((x) => (x.id === id ? { ...x, ...full, updated_at: now.toISOString() } : x))),
        () => setTasks(snapshot),
        async () => {
          await repo.updateTask(id, full);
          if (events.length) await repo.addTaskEvents(eventsFor(id, events)).catch(() => undefined);
        },
      );
    },
    [mutate, repo],
  );

  const find = (id: string) => tasksRef.current.find((x) => x.id === id);

  const api = useMemo<TasksApi>(() => {
    const clearLinger = (id: string) => {
      window.clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      setLingerIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      setLingerFocus((f) => (f === id ? null : f));
    };

    const createTask = (task: Task) => {
      const snapshotTasks = tasksRef.current;
      mutate(
        () => setTasks((all) => [...all, task]),
        () => setTasks(snapshotTasks),
        async () => {
          await repo.createTask(task);
          await repo.addTaskEvents(eventsFor(task.id, [{ type: 'created', at: task.created_at, from: null, to: task.status }])).catch(() => undefined);
        },
      );
    };

    return {
      tasks,
      captures,
      projects,
      people,
      status,
      linger: { ids: lingerIds, focusId: lingerFocus },
      toast,
      notify,

      complete(id) {
        const task = find(id);
        if (!task || task.status === 'done') return;
        prevStatus.current.set(id, task.status);
        setLingerIds((s) => new Set(s).add(id));
        if (task.is_focus) setLingerFocus(id);
        timers.current.set(id, window.setTimeout(() => clearLinger(id), LINGER_MS));
        commit(id, completePatch(new Date()));
      },
      undoComplete(id) {
        clearLinger(id);
        commit(id, reopenPatch(prevStatus.current.get(id) ?? 'planned', new Date()));
      },
      reschedule(id, day) {
        const task = find(id);
        if (task) commit(id, reschedulePatch(task, day, new Date()));
      },
      scheduleToday(id) {
        const task = find(id);
        if (task) commit(id, reschedulePatch(task, new Date(), new Date()));
      },
      setPriority(id, priority) {
        commit(id, { priority });
      },
      setFocus(id) {
        const snapshot = tasksRef.current;
        mutate(
          () => setTasks((all) => all.map((x) => ({ ...x, is_focus: x.id === id }))),
          () => setTasks(snapshot),
          () => repo.setFocus(id),
        );
      },
      setStatus(id, to) {
        const task = find(id);
        if (!task || task.status === to) return;
        if (task.status !== 'done' && to === 'done') prevStatus.current.set(id, task.status);
        commit(id, statusPatch(task, to, new Date()));
      },
      moveToBacklog(id) {
        commit(id, backlogPatch(new Date()));
      },
      pause(id) {
        commit(id, pausePatch());
      },
      wait(id) {
        commit(id, waitPatch());
      },
      delegate(id, name) {
        if (name.trim()) commit(id, delegatePatch(name));
      },
      followUp(id) {
        commit(id, followUpPatch(new Date()));
      },
      review(id) {
        commit(id, reviewPatch(new Date()));
      },
      remove(id) {
        const snapshot = tasksRef.current;
        mutate(
          () => setTasks((all) => all.filter((x) => x.id !== id)),
          () => setTasks(snapshot),
          () => repo.deleteTask(id),
        );
      },
      edit(id, patch) {
        commit(id, patch);
      },
      addTask(input) {
        const now = new Date();
        const status = input.status ?? 'inbox';
        createTask(
          newTask(
            {
              title: input.title.trim(),
              status,
              project_id: input.project_id ?? null,
              workstream_id: input.workstream_id ?? null,
              scheduled_date: input.scheduled_date ?? null,
              deadline: input.deadline ?? null,
              priority: input.priority ?? 'medium',
              completed_at: status === 'done' ? now.toISOString() : null,
              source: 'quick_add',
            },
            now,
          ),
        );
      },

      capture(content) {
        const item: InboxItem = { id: crypto.randomUUID(), content: content.trim(), created_at: new Date().toISOString(), status: 'inbox' };
        const snapshot = capturesRef.current;
        mutate(
          () => setCaptures((c) => [item, ...c]),
          () => setCaptures(snapshot),
          () => repo.createInboxItem(item),
        );
      },
      promoteCapture(id, patch = {}) {
        const cap = capturesRef.current.find((c) => c.id === id);
        if (!cap) return;
        const now = new Date();
        const status = patch.status ?? 'planned';
        const task = newTask(
          { title: cap.content, source: 'capture', created_at: cap.created_at, ...patch, status, completed_at: status === 'done' ? now.toISOString() : null, backlog_since: status === 'backlog' ? now.toISOString() : null, waiting_since: status === 'waiting' ? now.toISOString() : null },
          now,
        );
        const snapshotTasks = tasksRef.current;
        const snapshotCaps = capturesRef.current;
        mutate(
          () => {
            setTasks((all) => [...all, task]);
            setCaptures((c) => c.filter((x) => x.id !== id));
          },
          () => {
            setTasks(snapshotTasks);
            setCaptures(snapshotCaps);
          },
          async () => {
            await repo.createTask(task);
            await repo.updateInboxItem(id, { status: 'processed', task_id: task.id });
            await repo.addTaskEvents(eventsFor(task.id, [{ type: 'created', at: now.toISOString(), from: null, to: status }])).catch(() => undefined);
          },
        );
      },
      dropCapture(id) {
        const snapshot = capturesRef.current;
        mutate(
          () => setCaptures((c) => c.filter((x) => x.id !== id)),
          () => setCaptures(snapshot),
          () => repo.deleteInboxItem(id),
        );
      },

      async ensurePerson(name) {
        const clean = name.trim();
        if (!clean) return null;
        const existing = peopleRef.current.find((p) => p.name.toLowerCase() === clean.toLowerCase());
        if (existing) return existing.id;
        const person: Person = { id: crypto.randomUUID(), name: clean };
        setPeople((p) => [...p, person]);
        try {
          await repo.createPerson(person);
        } catch {
          setPeople((p) => p.filter((x) => x.id !== person.id));
          notify(t.errors.save);
          return null;
        }
        return person.id;
      },
      updatePerson(id, patch) {
        const snapshot = peopleRef.current;
        mutate(
          () => setPeople((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x))),
          () => setPeople(snapshot),
          () => repo.updatePerson(id, patch),
        );
      },
      loadEvents(taskId) {
        return repo.listTaskEvents(taskId).catch(() => []);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, captures, projects, people, status, lingerIds, lingerFocus, toast, commit, mutate, repo, notify]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useTasks(): TasksApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTasks outside TasksProvider');
  return v;
}

