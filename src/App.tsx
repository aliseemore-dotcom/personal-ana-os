import { useMemo } from 'react';
import { AuthGate } from './components/AuthGate';
import { ProjectsPage } from './components/projects/ProjectsPage';
import { TasksPage } from './components/tasks/TasksPage';
import { TodayPage } from './components/today/TodayPage';
import { hasSupabase } from './config';
import { createRepository } from './data';
import { ProjectsProvider } from './state/ProjectsProvider';
import { TasksProvider } from './state/TasksProvider';
import { useRoute } from './state/useRoute';

/** One task store and one people store, shared by TODAY, TASKS and PROJECTS. */
export default function App() {
  const repo = useMemo(createRepository, []);
  const [loc, navigate] = useRoute();
  const page = (signOut?: () => void) => (
    <TasksProvider repo={repo}>
      <ProjectsProvider repo={repo}>
        {loc.route === 'projects' ? (
          <ProjectsPage loc={loc} onNavigate={navigate} />
        ) : loc.route === 'tasks' ? (
          <TasksPage route={loc.route} onNavigate={navigate} />
        ) : (
          <TodayPage repo={repo} route={loc.route} onNavigate={navigate} onSignOut={signOut} />
        )}
      </ProjectsProvider>
    </TasksProvider>
  );
  return hasSupabase ? <AuthGate>{(signOut) => page(signOut)}</AuthGate> : page();
}
