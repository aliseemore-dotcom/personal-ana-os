import { useMemo } from 'react';
import { AuthGate } from './components/AuthGate';
import { TodayPage } from './components/today/TodayPage';
import { hasSupabase } from './config';
import { createRepository } from './data';
import { TasksProvider } from './state/TasksProvider';

export default function App() {
  const repo = useMemo(createRepository, []);
  const page = (signOut?: () => void) => (
    <TasksProvider repo={repo}>
      <TodayPage repo={repo} onSignOut={signOut} />
    </TasksProvider>
  );
  return hasSupabase ? <AuthGate>{(signOut) => page(signOut)}</AuthGate> : page();
}
