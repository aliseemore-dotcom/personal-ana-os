import { useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { dateKey } from '../../domain/dates';
import type { Project, Workstream } from '../../domain/types';
import { buildTimeline, splitTasks, type TaskView } from '../../logic/projectViews';
import { safeUrl, useProjects } from '../../state/ProjectsProvider';
import { useTasks } from '../../state/TasksProvider';
import { t } from '../../strings';

export interface Scope {
  project: Project;
  ws: Workstream | null;
  now: Date;
  openTask: (id: string) => void;
}

const inScope = (ws: Workstream | null, x: { workstream_id: string | null }) => !ws || x.workstream_id === ws.id;

/** Tag shown on records when the whole project is in view, to say which workstream they belong to. */
function useWsName() {
  const { workstreams } = useProjects();
  return (id: string | null) => (id ? workstreams.find((w) => w.id === id)?.name ?? null : null);
}

function WorkstreamSelect({ project, value, onChange, label }: { project: Project; value: string; onChange: (v: string) => void; label: string }) {
  const { workstreams } = useProjects();
  const options = workstreams.filter((w) => w.project_id === project.id);
  if (options.length === 0) return null;
  return (
    <label className="td-field">
      <span className="rg-label">{label}</span>
      <select className="td-input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t.hq.wholeProject}</option>
        {options.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    </label>
  );
}

/* ---------- Tasks ---------- */

export function TasksSection({ scope }: { scope: Scope }) {
  const api = useTasks();
  const wsName = useWsName();
  const [view, setView] = useState<TaskView>('current');
  const [title, setTitle] = useState('');
  const mine = api.tasks.filter((x) => x.project_id === scope.project.id && inScope(scope.ws, x));
  const groups = useMemo(() => splitTasks(mine, scope.now), [mine, scope.now]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = groups[view];
  const today = dateKey(scope.now);

  const add = () => {
    if (!title.trim()) return;
    api.addTask({ title, project_id: scope.project.id, workstream_id: scope.ws?.id ?? null, status: 'planned' });
    setTitle('');
  };

  return (
    <div className="pj-section">
      <div className="rg-tabs pj-subtabs" role="tablist">
        {(Object.keys(groups) as TaskView[]).map((v) => (
          <button key={v} className="rg-tab" role="tab" aria-selected={view === v} onClick={() => setView(v)}>
            {t.hqTasks.views[v]} <span className="rg-count rg-count--sm">{groups[v].length}</span>
          </button>
        ))}
      </div>

      <label className="rg-input">
        <span className="rg-input__icon"><Plus /></span>
        <input id="project-add-task" value={title} placeholder={t.hqTasks.add} aria-label={t.hqTasks.add} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="rg-input__action" onClick={add} disabled={!title.trim()}>{t.hqTasks.addBtn}</button>
      </label>

      {list.length === 0 ? (
        <p className="td-empty td-empty--ink">{t.hqTasks.empty[view]}</p>
      ) : (
        <ul className="td-list">
          {list.map((task) => {
            const done = task.status === 'done';
            const ws = !scope.ws ? wsName(task.workstream_id) : null;
            return (
              <li key={task.id} className="td-task" data-done={done}>
                <button className="td-check" onClick={() => (done ? api.undoComplete(task.id) : api.complete(task.id))} aria-label={done ? t.tasks.undo : `${t.tasks.complete}: ${task.title}`} aria-pressed={done}>
                  {done ? <Check size={14} /> : null}
                </button>
                <div className="td-task__main">
                  <button className="td-task__title" onClick={() => scope.openTask(task.id)}>{task.title}</button>
                  <p className="rg-small td-task__meta">
                    {ws && <span className="rg-tag tk-tag-xs">{ws}</span>}
                    {task.scheduled_date && !done && <span>{t.hqTasks.planned(task.scheduled_date)}</span>}
                    {task.deadline && !done && <span className={new Date(task.deadline) < scope.now ? 'tk-overdue' : ''}>{t.hqTasks.due(task.deadline)}</span>}
                    {task.delegated_to && <span>{t.board.delegatedTo(task.delegated_to)}</span>}
                  </p>
                </div>
                {!done &&
                  (task.scheduled_date === today ? (
                    <span className="rg-tag rg-tag--rose tk-tag-xs">{t.hqTasks.scheduledToday}</span>
                  ) : (
                    <button className="td-pill" onClick={() => api.scheduleToday(task.id)}>{t.hqTasks.today}</button>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- People ---------- */

const emptyLink = { name: '', organisation: '', role: '', relationship: '', last_interaction: '', next_action: '' };

export function PeopleSection({ scope }: { scope: Scope }) {
  const proj = useProjects();
  const tasks = useTasks();
  const wsName = useWsName();
  const [form, setForm] = useState<(typeof emptyLink & { id?: string }) | null>(null);
  const links = proj.links.filter((l) => l.project_id === scope.project.id && inScope(scope.ws, l));
  const person = (id: string) => tasks.people.find((p) => p.id === id);
  const set = (k: keyof typeof emptyLink, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const submit = async () => {
    if (!form || !form.name.trim()) return;
    await proj.saveLink({ ...form, project_id: scope.project.id, workstream_id: scope.ws?.id ?? null });
    setForm(null);
  };

  return (
    <div className="pj-section">
      <p className="rg-small rg-muted">{t.hqPeople.note}</p>
      {links.length === 0 && !form && <p className="td-empty td-empty--ink">{t.hqPeople.empty}</p>}
      <ul className="pj-rows">
        {links.map((l) => {
          const p = person(l.person_id);
          const ws = !scope.ws ? wsName(l.workstream_id) : null;
          return (
            <li key={l.id} className="pj-row">
              <div className="pj-row__main">
                <p className="pj-row__title">{p?.name ?? '—'} {ws && <span className="rg-tag tk-tag-xs">{ws}</span>}</p>
                <p className="rg-small rg-muted">
                  {[l.role, p?.organisation, l.relationship].filter(Boolean).join(' · ') || t.hq.notSet}
                </p>
                <p className="rg-small">
                  {l.last_interaction && <span>{t.hqPeople.lastInteraction}: {t.fmtDate(l.last_interaction)}. </span>}
                  {l.next_action && <span>{t.hqPeople.nextAction}: {l.next_action}</span>}
                </p>
              </div>
              <div className="td-att__actions">
                <button className="td-pill" onClick={() => setForm({ id: l.id, name: p?.name ?? '', organisation: p?.organisation ?? '', role: l.role ?? '', relationship: l.relationship ?? '', last_interaction: l.last_interaction ?? '', next_action: l.next_action ?? '' })}>{t.hqPeople.edit}</button>
                <button className="td-pill" onClick={() => proj.removeLink(l.id)}>{t.hqPeople.remove}</button>
              </div>
            </li>
          );
        })}
      </ul>
      {form ? (
        <div className="rg-card rg-card--soft pj-form">
          <div className="td-form">
            <label className="td-field"><span className="rg-label">{t.hqPeople.name}</span><input className="td-input" list="pj-people" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus /><datalist id="pj-people">{tasks.people.map((p) => <option key={p.id} value={p.name} />)}</datalist></label>
            <label className="td-field"><span className="rg-label">{t.hqPeople.organisation}</span><input className="td-input" value={form.organisation} onChange={(e) => set('organisation', e.target.value)} /></label>
            <label className="td-field"><span className="rg-label">{t.hqPeople.role}</span><input className="td-input" value={form.role} onChange={(e) => set('role', e.target.value)} /></label>
            <label className="td-field"><span className="rg-label">{t.hqPeople.relationship}</span><input className="td-input" value={form.relationship} onChange={(e) => set('relationship', e.target.value)} /></label>
            <label className="td-field"><span className="rg-label">{t.hqPeople.lastInteraction}</span><input className="td-input" type="date" value={form.last_interaction} onChange={(e) => set('last_interaction', e.target.value)} /></label>
            <label className="td-field"><span className="rg-label">{t.hqPeople.nextAction}</span><input className="td-input" value={form.next_action} onChange={(e) => set('next_action', e.target.value)} /></label>
          </div>
          <div className="td-modal__foot">
            <span className="td-modal__spacer" />
            <button className="rg-btn rg-btn--glass" onClick={() => setForm(null)}>{t.hqPeople.cancel}</button>
            <button className="rg-btn" onClick={() => void submit()} disabled={!form.name.trim()}>{t.hqPeople.save}</button>
          </div>
        </div>
      ) : (
        <button className="td-pill td-pill--solid pj-add" onClick={() => setForm({ ...emptyLink })}>{t.hqPeople.link}</button>
      )}
    </div>
  );
}

/* ---------- Decisions ---------- */

export function DecisionsSection({ scope }: { scope: Scope }) {
  const proj = useProjects();
  const tasks = useTasks();
  const wsName = useWsName();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: dateKey(scope.now), decision: '', context: '', people: '', ws: scope.ws?.id ?? '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const list = proj.decisions
    .filter((d) => d.project_id === scope.project.id && inScope(scope.ws, d))
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));

  const save = async () => {
    if (!f.decision.trim()) return;
    await proj.addDecision({
      project_id: scope.project.id, workstream_id: scope.ws?.id ?? (f.ws || null), date: f.date, decision: f.decision, context: f.context,
      people: f.people.split(',').map((x) => x.trim()).filter(Boolean),
    });
    setF({ date: dateKey(new Date()), decision: '', context: '', people: '', ws: scope.ws?.id ?? '' });
    setOpen(false);
  };

  return (
    <div className="pj-section">
      {!open && <button className="td-pill td-pill--solid pj-add" onClick={() => setOpen(true)}>{t.hqDecisions.record}</button>}
      {open && (
        <div className="rg-card rg-card--soft pj-form">
          <div className="td-form">
            <label className="td-field"><span className="rg-label">{t.hqDecisions.date}</span><input className="td-input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></label>
            {!scope.ws && <WorkstreamSelect project={scope.project} value={f.ws} onChange={(v) => set('ws', v)} label={t.hqDecisions.related} />}
            <label className="td-field td-field--wide"><span className="rg-label">{t.hqDecisions.decision}</span><textarea className="td-input td-input--area" rows={2} value={f.decision} onChange={(e) => set('decision', e.target.value)} autoFocus /></label>
            <label className="td-field td-field--wide"><span className="rg-label">{t.hqDecisions.context}</span><textarea className="td-input td-input--area" rows={2} value={f.context} onChange={(e) => set('context', e.target.value)} /></label>
            <label className="td-field td-field--wide"><span className="rg-label">{t.hqDecisions.people}</span><input className="td-input" list="pj-dec-people" placeholder={t.hqDecisions.peoplePlaceholder} value={f.people} onChange={(e) => set('people', e.target.value)} /><datalist id="pj-dec-people">{tasks.people.map((p) => <option key={p.id} value={p.name} />)}</datalist></label>
          </div>
          <div className="td-modal__foot">
            <span className="td-modal__spacer" />
            <button className="rg-btn rg-btn--glass" onClick={() => setOpen(false)}>{t.hqDecisions.cancel}</button>
            <button className="rg-btn" onClick={() => void save()} disabled={!f.decision.trim()}>{t.hqDecisions.save}</button>
          </div>
        </div>
      )}
      {list.length === 0 && !open && <p className="td-empty td-empty--ink">{t.hqDecisions.empty}</p>}
      <ul className="pj-rows">
        {list.map((d) => {
          const ws = !scope.ws ? wsName(d.workstream_id) : null;
          const who = [...new Set([...d.people_ids.map((id) => tasks.people.find((p) => p.id === id)?.name), ...(d.people_names ?? [])].filter(Boolean))].join(', ');
          return (
            <li key={d.id} className="pj-row pj-row--decision">
              <p className="rg-label pj-row__date">{t.fmtDate(d.date)} {ws && <span className="rg-tag tk-tag-xs">{ws}</span>}</p>
              <p className="pj-row__decision">{d.decision}</p>
              {d.context && <p className="rg-small"><span className="rg-label">{t.hqDecisions.contextLabel}</span> {d.context}</p>}
              {who && <p className="rg-small rg-muted">{t.hqDecisions.people}: {who}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Notes ---------- */

export function NotesSection({ scope }: { scope: Scope }) {
  const proj = useProjects();
  const wsName = useWsName();
  const [body, setBody] = useState('');
  const list = proj.notes.filter((n) => n.project_id === scope.project.id && inScope(scope.ws, n)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const add = () => {
    if (!body.trim()) return;
    proj.addNote(scope.project.id, scope.ws?.id ?? null, body);
    setBody('');
  };
  return (
    <div className="pj-section">
      <label className="td-field">
        <span className="rg-label">{t.hqNotes.add}</span>
        <textarea id="project-note" className="td-input td-input--area" rows={3} value={body} placeholder={t.hqNotes.placeholder} onChange={(e) => setBody(e.target.value)} />
      </label>
      <button className="td-pill td-pill--solid pj-add" onClick={add} disabled={!body.trim()}>{t.hqNotes.add}</button>
      {list.length === 0 && <p className="td-empty td-empty--ink">{t.hqNotes.empty}</p>}
      <ul className="pj-rows">
        {list.map((n) => {
          const ws = !scope.ws ? wsName(n.workstream_id) : null;
          return (
            <li key={n.id} className="pj-row pj-row--note">
              <p className="rg-label pj-row__date">{t.fmtDate(n.created_at)}, {new Date(n.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })} {ws && <span className="rg-tag tk-tag-xs">{ws}</span>}</p>
              <p className="pj-note__body">{n.body}</p>
              <button className="td-link" onClick={() => proj.deleteNote(n.id)}>{t.hqNotes.remove}</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Documents ---------- */

export function DocumentsSection({ scope }: { scope: Scope }) {
  const proj = useProjects();
  const wsName = useWsName();
  const [f, setF] = useState({ name: '', type: 'document', url: '', ws: scope.ws?.id ?? '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.name.trim() && safeUrl(f.url);
  const list = proj.documents.filter((d) => d.project_id === scope.project.id && inScope(scope.ws, d));
  const add = () => {
    if (!valid) return;
    proj.addDocument({ project_id: scope.project.id, workstream_id: scope.ws?.id ?? (f.ws || null), name: f.name, type: f.type, url: f.url });
    setF({ name: '', type: 'document', url: '', ws: scope.ws?.id ?? '' });
  };
  return (
    <div className="pj-section">
      <div className="rg-card rg-card--soft pj-form">
        <div className="td-form">
          <label className="td-field"><span className="rg-label">{t.hqDocs.name}</span><input className="td-input" value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className="td-field"><span className="rg-label">{t.hqDocs.type}</span>
            <select className="td-input" value={f.type} onChange={(e) => set('type', e.target.value)}>{Object.entries(t.hqDocs.types).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label className="td-field td-field--wide"><span className="rg-label">{t.hqDocs.url}</span><input className="td-input" inputMode="url" value={f.url} placeholder="https://" onChange={(e) => set('url', e.target.value)} /><span className="rg-small rg-muted">{f.url && !safeUrl(f.url) ? t.hqDocs.badUrl : t.hqDocs.urlHint}</span></label>
          {!scope.ws && <WorkstreamSelect project={scope.project} value={f.ws} onChange={(v) => set('ws', v)} label={t.hqDecisions.related} />}
        </div>
        <div className="td-modal__foot"><span className="td-modal__spacer" /><button className="rg-btn" onClick={add} disabled={!valid}>{t.hqDocs.add}</button></div>
      </div>
      {list.length === 0 && <p className="td-empty td-empty--ink">{t.hqDocs.empty}</p>}
      <ul className="pj-rows">
        {list.map((d) => {
          const ws = !scope.ws ? wsName(d.workstream_id) : null;
          return (
            <li key={d.id} className="pj-row">
              <div className="pj-row__main">
                <p className="pj-row__title">{d.name} {ws && <span className="rg-tag tk-tag-xs">{ws}</span>}</p>
                <p className="rg-small rg-muted">{t.hqDocs.types[d.type] ?? d.type} · {t.hqDocs.updated(d.updated_at)}</p>
              </div>
              <div className="td-att__actions">
                <a className="td-pill td-pill--solid" href={d.url} target="_blank" rel="noopener noreferrer">{t.hqDocs.open}</a>
                <button className="td-pill" onClick={() => proj.deleteDocument(d.id)}>{t.hqDocs.remove}</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Timeline ---------- */

export function TimelineSection({ scope }: { scope: Scope }) {
  const proj = useProjects();
  const tasks = useTasks();
  const wsName = useWsName();
  const items = useMemo(
    () => buildTimeline(proj.events, tasks.tasks, scope.project.id, scope.ws?.id ?? null, { project: scope.project, workstreams: proj.workstreams.filter((w) => w.project_id === scope.project.id), decisions: proj.decisions, notes: proj.notes }),
    [proj.events, proj.workstreams, proj.decisions, proj.notes, tasks.tasks, scope.project, scope.ws],
  );
  if (items.length === 0) return <p className="td-empty td-empty--ink">{t.hqTimeline.empty}</p>;
  return (
    <ol className="pj-timeline">
      {items.slice(0, 60).map((e) => {
        const ws = !scope.ws ? wsName(e.workstream_id) : null;
        return (
          <li key={e.id} className="pj-timeline__item">
            <time className="rg-small rg-muted">{t.fmtDate(e.at)}</time>
            <span>{t.hqTimeline.event(e)} {ws && e.type !== 'workstream_added' && <span className="rg-tag tk-tag-xs">{ws}</span>}</span>
          </li>
        );
      })}
    </ol>
  );
}

