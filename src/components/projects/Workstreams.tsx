import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Project, Task, Workstream } from '../../domain/types';
import { assessWorkstream } from '../../logic/projectHealth';
import { DEFAULT_THRESHOLDS } from '../../logic/thresholds';
import { useProjects } from '../../state/ProjectsProvider';
import { t } from '../../strings';
import { HealthTag, StatusTag } from './Tags';

/** Children of the project: opportunities, locations, trips or workstreams. Never top-level projects. */
export function Workstreams({ project, items, tasks, now }: { project: Project; items: Workstream[]; tasks: Task[]; now: Date }) {
  const api = useProjects();
  const noun = t.hq.nouns[project.workstream_kind];
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [past, setPast] = useState(false);

  const active = items.filter((w) => w.status !== 'completed');
  const completed = items.filter((w) => w.status === 'completed');
  const shown = past ? [...active, ...completed] : active;

  const add = () => {
    if (!name.trim()) return;
    api.addWorkstream(project.id, name, project.workstream_kind, project.workstream_kind === 'trip' && start ? { start_date: start, end_date: end || start } : undefined);
    setName(''); setStart(''); setEnd('');
  };

  return (
    <section className="pj-ws" aria-labelledby="ws-title">
      <div className="td-section-head">
        <h2 className="rg-h2" id="ws-title">{noun.title}</h2>
        {completed.length > 0 && (
          <button className="td-link" onClick={() => setPast((v) => !v)} aria-expanded={past}>
            {past ? t.hq.hideCompleted : t.hq.showCompleted(completed.length)}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="td-empty">{noun.empty}</p>
      ) : (
        <ul className="pj-ws__grid">
          {shown.map((w) => {
            const a = assessWorkstream(w, tasks.filter((x) => x.workstream_id === w.id), now, DEFAULT_THRESHOLDS);
            const open = tasks.filter((x) => x.workstream_id === w.id && x.status !== 'done').length;
            const meta = w.metadata as { start_date?: string; end_date?: string };
            return (
              <li key={w.id}>
                <a className="pj-ws__card" href={`#projects/${project.id}/${w.id}`} data-done={w.status === 'completed'}>
                  <span className="pj-ws__name">{w.name}</span>
                  {meta.start_date && <span className="rg-small rg-muted">{t.hq.tripDates(meta.start_date, meta.end_date ?? meta.start_date)}</span>}
                  <span className="pj-ws__tags">
                    {w.status !== 'active' && <StatusTag status={w.status} />}
                    {w.status !== 'completed' && a.health !== 'on_track' && <HealthTag health={a.health} />}
                  </span>
                  {a.next && <span className="rg-small pj-ws__next">{a.next.text}</span>}
                  {open > 0 && <span className="rg-small rg-muted">{open} open</span>}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pj-ws__add">
        <label className="rg-input">
          <span className="rg-input__icon"><Plus /></span>
          <input id="add-workstream" value={name} placeholder={noun.placeholder} aria-label={noun.add} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="rg-input__action" onClick={add} disabled={!name.trim()}>{noun.add}</button>
        </label>
        {project.workstream_kind === 'trip' && (
          <div className="pj-ws__dates">
            <input className="tk-select" type="date" aria-label="Start date" value={start} onChange={(e) => setStart(e.target.value)} />
            <input className="tk-select" type="date" aria-label="End date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </div>
        )}
      </div>
    </section>
  );
}
