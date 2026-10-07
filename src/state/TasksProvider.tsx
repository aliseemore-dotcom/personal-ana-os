import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Repository } from '../data';
import type { Project, Task, TaskPatch, TaskStatus } from '../domain/types';
import { backlogPatch, completePatch, doNowPatch, reopenPatch, reschedulePatch, touchPatch } from '../logic/taskActions';
import type { Linger } from '../logic/todayModel';
import { t } from '../strings';

const LINGER_MS = 2200;

interface TasksApi {
  tasks: Task[];
  projects: Map<string, Project>;
  status: 'loading' | 'ready' | 'error';
  linger: Linger;
  toast: string | null;
  complete(id: string): void;
  undoComplete(id: string): void;
  reschedule(id: string, day: Date): void;
  setPriority(id: string, p: Task['priority']): void;
  setFocus(id: string): void;
  moveToBacklog(id: string): void;
  doNow(id: string): void;
  keep(id: string): void;
  remove(id: string): void;
  edit(id: string, patch: TaskPatch): void;
  notify(message: string): void;
}

const Ctx = createContext<TasksApi | null>(null);

export function TasksProvider({ repo, children }: { repo: Repository; children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Map<string, Project>>(new Map());
  const [status, setStatus] = useState<TasksApi['status']>('loading');
  const [lingerIds, setLingerIds] = useState<ReadonlySet<string>>(new Set());
  const [lingerFocus, setLingerFocus] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
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
      const [ts, ps] = await Promise.all([repo.listTasks(), repo.listProjects()]);
      if (pending.current > 0) return;
      setTasks(ts);
      setProjects(new Map(ps.map((p) => [p.id, p])));
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
    (apply: (all: Task[]) => Task[], persist: () => Promise<void>) => {
      const snapshot = tasksRef.current;
      setTasks(apply(snapshot));
      pending.current++;
      persist()
        .catch(() => {
          setTasks(snapshot);
          notify(t.errors.save);
        })
        .finally(() => {
          pending.current--;
        });
    },
    [notify],
  );

  const patchTask = useCallback(
    (id: string, patch: TaskPatch) =>
      mutate(
        (all) => all.map((x) => (x.id === id ? { ...x, ...patch, updated_at: new Date().toISOString() } : x)),
        () => repo.updateTask(id, patch),
      ),
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
    return {
      tasks,
      projects,
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
        patchTask(id, completePatch(new Date()));
        // is_focus is cleared by the patch; the linger keeps the card on screen briefly.
      },
      undoComplete(id) {
        clearLinger(id);
        const prev = prevStatus.current.get(id) ?? 'planned';
        patchTask(id, reopenPatch(prev, new Date()));
      },
      reschedule(id, day) {
        const task = find(id);
        if (task) patchTask(id, reschedulePatch(task, day, new Date()));
      },
      setPriority(id, priority) {
        patchTask(id, { priority, last_activity_at: new Date().toISOString() });
      },
      setFocus(id) {
        mutate(
          (all) => all.map((x) => ({ ...x, is_focus: x.id === id })),
          () => repo.setFocus(id),
        );
      },
      moveToBacklog(id) {
        patchTask(id, backlogPatch(new Date()));
      },
      doNow(id) {
        patchTask(id, doNowPatch(new Date()));
      },
      keep(id) {
        patchTask(id, touchPatch(new Date()));
      },
      remove(id) {
        mutate(
          (all) => all.filter((x) => x.id !== id),
          () => repo.deleteTask(id),
        );
      },
      edit(id, patch) {
        patchTask(id, { ...patch, last_activity_at: new Date().toISOString() });
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, projects, status, lingerIds, lingerFocus, toast, patchTask, mutate, repo, notify]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useTasks(): TasksApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTasks outside TasksProvider');
  return v;
}
