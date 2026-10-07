import { useMemo, useState } from 'react';
import type { Repository } from '../../data';
import { detectAttention } from '../../logic/attention';
import { buildToday } from '../../logic/todayModel';
import { useTasks } from '../../state/TasksProvider';
import { useNow } from '../../state/useNow';
import { useUpcomingEvents } from '../../state/useUpcomingEvents';
import { useWeather } from '../../state/useWeather';
import { t } from '../../strings';
import { Toast } from '../ui';
import { AttentionNeeded } from './AttentionNeeded';
import { DailyQuestion } from './DailyQuestion';
import { FocusCard } from './FocusCard';
import { FocusPicker } from './FocusPicker';
import { Header } from './Header';
import { QuickCapture } from './QuickCapture';
import { AppNav } from '../AppNav';
import { TaskDetail } from '../tasks/TaskDetail';
import type { Route } from '../../state/useRoute';
import { TodayTasks } from './TodayTasks';
import { UpcomingEvents } from './UpcomingEvents';

/**
 * Composition only. Every number and list on the page comes from the pure
 * functions in /logic, fed by the task store, the calendar service and the clock.
 */
export function TodayPage({ repo, route, onNavigate, onSignOut }: { repo: Repository; route: Route; onNavigate: (hash: string) => void; onSignOut?: () => void }) {
  const now = useNow();
  const api = useTasks();
  const weather = useWeather();
  const { events, error: calendarError } = useUpcomingEvents(now);
  const [openId, setOpenId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const model = useMemo(() => buildToday(api.tasks, now, api.linger), [api.tasks, now, api.linger]);
  const attention = useMemo(() => detectAttention(api.tasks, now), [api.tasks, now]);
  const openTask = openId ? api.tasks.find((x) => x.id === openId) : undefined;

  return (
    <div className="rg rg-stage td-stage">
      <div className="rg-orb td-orb td-orb--a" aria-hidden />
      <div className="rg-orb td-orb td-orb--b" aria-hidden />

      <main className="td-page">
        <AppNav route={route} onNavigate={onNavigate} />
        <Header now={now} weather={weather} onSignOut={onSignOut} />

        {api.status === 'loading' && <p className="td-empty">{t.loading}</p>}
        {api.status === 'error' && <p className="td-empty">{t.errors.load}</p>}

        {api.status === 'ready' && (
          <div className="td-grid">
            <div className="td-primary">
              <FocusCard model={model} now={now} onChange={() => setPicking(true)} onOpen={setOpenId} />
            </div>
            <aside className="td-aside">
              <UpcomingEvents events={events} now={now} error={calendarError} />
            </aside>

            <div className="td-secondary">
              <TodayTasks model={model} now={now} onOpen={setOpenId} />
            </div>
            <aside className="td-aside td-aside--stack">
              <AttentionNeeded summary={attention} now={now} />
              <DailyQuestion repo={repo} now={now} onError={api.notify} />
            </aside>
          </div>
        )}

        {repo.kind === 'local' && <p className="rg-small td-demo">{t.demo}</p>}
      </main>

      <QuickCapture />
      {picking && <FocusPicker candidates={model.candidates} currentId={model.focus?.task.id} onClose={() => setPicking(false)} />}
      {openTask && <TaskDetail key={openTask.id} task={openTask} now={now} onClose={() => setOpenId(null)} />}
      <Toast message={api.toast} />
    </div>
  );
}
