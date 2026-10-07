import { useMemo } from 'react';
import { assessProject } from '../logic/projectHealth';
import type { ProjectView } from '../logic/projectViews';
import { DEFAULT_THRESHOLDS } from '../logic/thresholds';
import { useProjects } from './ProjectsProvider';
import { useTasks } from './TasksProvider';

/** Joins projects with their tasks and workstreams from the shared stores, and assesses each. */
export function useProjectViews(now: Date): ProjectView[] {
  const P = useProjects();
  const T = useTasks();
  return useMemo(
    () =>
      P.projects.map((project) => {
        const tasks = T.tasks.filter((t) => t.project_id === project.id);
        const workstreams = P.workstreams.filter((w) => w.project_id === project.id);
        return { project, tasks, workstreams, assessment: assessProject(project, tasks, workstreams, now, DEFAULT_THRESHOLDS) };
      }),
    [P.projects, P.workstreams, T.tasks, now],
  );
}
