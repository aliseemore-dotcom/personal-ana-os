import { useMemo } from 'react';
import { AuthGate } from './components/AuthGate';
import { TasksPage } from './components/tasks/TasksPage';
import { TodayPage } from './components/today/TodayPage';
import { hasSupabase } from './config';
import { createRepository } from './data';
import { TasksProvider } from './state/TasksProvider';
import { useRoute } from './state/useRoute';

/** One task store, two views: TODAY and TASKS read and write the same records. */
export default function App() {
  const repo = useMemo(createRepository, []);
  const [route, navigate] = useRoute();
  const page = (signOut?: () => void) => (
    <TasksProvider repo={repo}>
      {route === 'tasks' ? <TasksPage route={route} onNavigate={navigate} /> : <TodayPage repo={repo} route={route} onNavigate={navigate} onSignOut={signOut} />}
    </TasksProvider>
  );
  return hasSupabase ? <AuthGate>{(signOut) => page(signOut)}</AuthGate> : page();
}
