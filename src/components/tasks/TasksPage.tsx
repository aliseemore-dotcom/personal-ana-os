import { useMemo, useState } from 'react';
import type { TaskStatus } from '../../domain/types';
import { buildCleanupQueue, type CleanupItem } from '../../logic/cleanup';
import { buildDecisions, decisionsLead } from '../../logic/decisions';
import { applyFilters, EMPTY_FILTERS, filterCaptures, isFiltering, type Filters } from '../../logic/filters';
import { buildSummary } from '../../logic/summary';
import { DEFAULT_THRESHOLDS } from '../../logic/thresholds';
import { inProgress, wouldOverload } from '../../logic/wip';
import { useTasks } from '../../state/TasksProvider';
import { useNow } from '../../state/useNow';
import { t } from '../../strings';
import { AppNav } from '../AppNav';
import { Toast } from '../ui';
import { QuickCapture } from '../today/QuickCapture';
import type { Route } from '../../state/useRoute';
import { AssistantSummary } from './AssistantSummary';
import { Board, type ItemRef } from './Board';
import { NeedsDecision } from './NeedsDecision';
import { TaskDetail } from './TaskDetail';
import { FilterBar, QuickAdd } from './Toolbar';
import { CleanupCard, WeeklyCleanup } from './WeeklyCleanup';
import { WipDialog } from './WipDialog';

const TH = DEFAULT_THRESHOLDS;

/** Composition only: all interpretation lives in /logic. */
export function TasksPage({ route, onNavigate }: { route: Route; onNavigate: (hash: string) => void }) {
  const now = useNow();
  const api = useTasks();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [wip, setWip] = useState<{ ref: ItemRef; to: TaskStatus } | null>(null);
  const [cleanup, setCleanup] = useState<CleanupItem[] | null>(null);

  const projectName = (id: string | null) => (id ? api.projects.get(id)?.name ?? '' : '');
  const summary = useMemo(() => buildSummary(api.tasks, api.captures, now, TH), [api.tasks, api.captures, now]);
  const decisions = useMemo(() => buildDecisions(api.tasks, api.captures, now, TH), [api.tasks, api.captures, now]);
  const lead = useMemo(() => decisionsLead(decisions, TH), [decisions]);
  const queue = useMemo(() => buildCleanupQueue(api.tasks, api.captures, now, TH), [api.tasks, api.captures, now]);

  const shownTasks = useMemo(() => applyFilters(api.tasks, filters, now, projectName, TH), [api.tasks, filters, now, api.projects]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownCaptures = useMemo(() => filterCaptures(api.captures, filters), [api.captures, filters]);
  const wipCount = inProgress(api.tasks).length;
  const openTask = openId ? api.tasks.find((x) => x.id === openId) : undefined;

  const perform = (ref: ItemRef, to: TaskStatus) => {
    if (ref.kind === 'task') api.setStatus(ref.id, to);
    else api.promoteCapture(ref.id, { status: to });
  };

  /** Moving into In progress past the limit asks first; it never refuses. */
  const requestMove = (ref: ItemRef, to: TaskStatus) => {
    const current = ref.kind === 'task' ? api.tasks.find((x) => x.id === ref.id) : undefined;
    if (ref.kind === 'task' && !current) return;
    if (to === 'in_progress' && current?.status !== 'in_progress' && wouldOverload(api.tasks, TH.wipLimit)) {
      setWip({ ref, to });
      return;
    }
    perform(ref, to);
  };

  const wipTitle = wip ? (wip.ref.kind === 'task' ? api.tasks.find((x) => x.id === wip.ref.id)?.title : api.captures.find((c) => c.id === wip.ref.id)?.content) ?? '' : '';

  return (
    <div className="rg rg-stage td-stage">
      <div className="rg-orb td-orb td-orb--a" aria-hidden />
      <div className="rg-orb td-orb td-orb--b" aria-hidden />

      <main className="td-page tk-page">
        <AppNav route={route} onNavigate={onNavigate} />
        <header className="tk-header">
          <h1 className="td-date">{t.tasksPage.title}</h1>
          <p className="td-greeting">{t.tasksPage.subtitle}</p>
        </header>

        {api.status === 'loading' && <p className="td-empty">{t.loading}</p>}
        {api.status === 'error' && <p className="td-empty">{t.errors.load}</p>}

        {api.status === 'ready' && (
          <>
            <div className="tk-top">
              <AssistantSummary summary={summary} />
              <CleanupCard count={queue.length} onStart={() => setCleanup(queue)} />
            </div>

            <NeedsDecision items={decisions} lead={lead} now={now} onOpen={setOpenId} />

            <section className="rg-glass tk-tools" aria-label={t.board.title}>
              <QuickAdd />
              <FilterBar filters={filters} onChange={setFilters} count={shownTasks.length + shownCaptures.length} />
            </section>

            <Board
              tasks={shownTasks}
              captures={shownCaptures}
              now={now}
              projectName={projectName}
              wipLimit={TH.wipLimit}
              wipCount={wipCount}
              onMove={requestMove}
              onOpen={setOpenId}
              empty={isFiltering(filters)}
            />
          </>
        )}
      </main>

      <QuickCapture />
      {openTask && (
        <TaskDetail key={openTask.id} task={openTask} now={now} onClose={() => setOpenId(null)} onMove={(id, to) => requestMove({ kind: 'task', id }, to)} />
      )}
      {wip && (
        <WipDialog
          incoming={wipTitle}
          inProgress={inProgress(api.tasks)}
          projectName={projectName}
          onFree={(id, how) => {
            if (how === 'pause') api.pause(id);
            else if (how === 'backlog') api.moveToBacklog(id);
            else api.complete(id);
            perform(wip.ref, wip.to);
            setWip(null);
          }}
          onContinue={() => { perform(wip.ref, wip.to); setWip(null); }}
          onCancel={() => setWip(null)}
        />
      )}
      {cleanup && <WeeklyCleanup queue={cleanup} now={now} onClose={() => setCleanup(null)} />}
      <Toast message={api.toast} />
    </div>
  );
}

