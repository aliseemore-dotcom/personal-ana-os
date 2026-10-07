import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { ProjectCategory } from '../../domain/types';
import { buildProjectsSummary } from '../../logic/projectsSummary';
import { EMPTY_PROJECT_FILTERS, filterProjects, sortProjects, type ProjectFilters } from '../../logic/projectViews';
import { useProjects } from '../../state/ProjectsProvider';
import { useTasks } from '../../state/TasksProvider';
import { useNow } from '../../state/useNow';
import { useProjectViews } from '../../state/useProjectViews';
import type { Location } from '../../state/useRoute';
import { t } from '../../strings';
import { AppNav } from '../AppNav';
import { QuickCapture } from '../today/QuickCapture';
import { Toast } from '../ui';
import { ProjectCard } from './ProjectCard';
import { ProjectHQ } from './ProjectHQ';

const CATEGORIES: (ProjectCategory | '')[] = ['', 'work', 'business', 'personal'];

function Overview({ now }: { now: Date }) {
  const views = useProjectViews(now);
  const [f, setF] = useState<ProjectFilters>(EMPTY_PROJECT_FILTERS);
  const summary = useMemo(() => buildProjectsSummary(views), [views]);
  const shown = useMemo(() => sortProjects(filterProjects(views, f)), [views, f]);
  const x = t.projectsPage;
  const narrowed = f.status || f.health || f.query;

  return (
    <>
      <section className="rg-glass pj-summary" aria-labelledby="pj-sum">
        <h2 className="rg-label" id="pj-sum">{x.label}</h2>
        <div className="pj-summary__lead">
          <p className="pj-summary__count">{x.count(summary.total)}</p>
          <div className="pj-summary__tags">
            <span className="rg-tag rg-tag--rose">{x.active(summary.active)}</span>
            {summary.needAttention > 0 && <span className="rg-tag rg-tag--warning"><span className="rg-tag__dot" />{x.attention(summary.needAttention)}</span>}
          </div>
        </div>
        {summary.lines.length === 0 ? (
          <p className="tk-summary__calm">{x.calm}</p>
        ) : (
          <ul className="tk-obs">
            {summary.lines.map((l, i) => (
              <li key={`${l.code}-${i}`} className="tk-obs__item" data-tone={l.code === 'blocker' ? 'critical' : 'warn'}>
                <span className="tk-obs__dot" aria-hidden />
                {x.line(l)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="pj-tools">
        <div className="rg-tabs" role="tablist" aria-label={x.categoryTabs}>
          {CATEGORIES.map((c) => (
            <button key={c || 'all'} className="rg-tab" role="tab" aria-selected={f.category === c} onClick={() => setF({ ...f, category: c })}>
              {x.categories[c]}
            </button>
          ))}
        </div>
        <label className="rg-input pj-search">
          <span className="rg-input__icon"><Search /></span>
          <input id="project-search" type="search" value={f.query} placeholder={x.search} aria-label={x.search} onChange={(e) => setF({ ...f, query: e.target.value })} />
        </label>
        <select className="tk-select" aria-label={t.hq.statusLabel} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ProjectFilters['status'] })}>
          <option value="">{x.anyStatus}</option>
          {Object.entries(x.statuses).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="tk-select" aria-label={t.hq.healthLabel} value={f.health} onChange={(e) => setF({ ...f, health: e.target.value as ProjectFilters['health'] })}>
          <option value="">{x.anyHealth}</option>
          {Object.entries(x.healths).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {narrowed ? <button className="td-pill" onClick={() => setF({ ...EMPTY_PROJECT_FILTERS, category: f.category })}>{x.clear}</button> : null}
      </div>

      {shown.length === 0 ? (
        <p className="td-empty">{x.noMatch}</p>
      ) : (
        <ul className="pj-grid">{shown.map((v) => <ProjectCard key={v.project.id} view={v} />)}</ul>
      )}
    </>
  );
}

export function ProjectsPage({ loc, onNavigate }: { loc: Location; onNavigate: (hash: string) => void }) {
  const now = useNow();
  const tasks = useTasks();
  const projects = useProjects();
  const ready = tasks.status === 'ready' && projects.status === 'ready';
  const hq = loc.projectId ? projects.projects.find((p) => p.id === loc.projectId) : undefined;

  return (
    <div className="rg rg-stage td-stage">
      <div className="rg-orb td-orb td-orb--a" aria-hidden />
      <div className="rg-orb td-orb td-orb--b" aria-hidden />
      <main className="td-page tk-page pj-page">
        <AppNav route="projects" onNavigate={onNavigate} />
        {!loc.projectId && (
          <header className="tk-header">
            <h1 className="td-date">{t.projectsPage.title}</h1>
            <p className="td-greeting">{t.projectsPage.subtitle}</p>
          </header>
        )}
        {!ready && <p className="td-empty">{tasks.status === 'error' || projects.status === 'error' ? t.errors.load : t.loading}</p>}
        {ready && loc.projectId && hq && <ProjectHQ project={hq} workstreamId={loc.workstreamId} now={now} />}
        {ready && loc.projectId && !hq && (
          <p className="td-empty">That project no longer exists. <a className="td-link" href="#projects">{t.hq.back}</a></p>
        )}
        {ready && !loc.projectId && <Overview now={now} />}
      </main>
      <QuickCapture />
      <Toast message={tasks.toast} />
    </div>
  );
}
