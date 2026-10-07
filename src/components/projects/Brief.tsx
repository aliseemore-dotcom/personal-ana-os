import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { Health, Project, ProjectStatus, Workstream } from '../../domain/types';
import type { ProjectAssessment } from '../../logic/projectHealth';
import { useProjects } from '../../state/ProjectsProvider';
import { t } from '../../strings';

type Target = { kind: 'project'; project: Project } | { kind: 'workstream'; ws: Workstream; project: Project };

const Cell = ({ label, children, accent }: { label: string; children: React.ReactNode; accent?: boolean }) => (
  <div className={`pj-brief__cell${accent ? ' pj-brief__cell--accent' : ''}`}>
    <h3 className="rg-label">{label}</h3>
    <div className="pj-brief__text">{children}</div>
  </div>
);

const has = (v: string | null | undefined) => Boolean(v && v.trim());

const Text = ({ v }: { v: string | null | undefined }) => (v && v.trim() ? <>{v}</> : <span className="rg-muted">{t.hq.notSet}</span>);

/** The executive brief: where the project stands, readable in a few seconds. Editable in place. */
export function Brief({ target, assessment }: { target: Target; assessment: ProjectAssessment }) {
  const api = useProjects();
  const [editing, setEditing] = useState(false);
  const src = target.kind === 'project' ? target.project : target.ws;
  const [f, setF] = useState({
    summary: src.summary ?? '',
    objective: target.kind === 'project' ? target.project.objective ?? '' : '',
    statusNote: target.kind === 'project' ? target.project.status_note ?? '' : '',
    next: src.next_action ?? '',
    blocker: src.blocker ?? '',
    milestone: src.next_milestone ?? '',
    milestoneDate: target.kind === 'project' ? target.project.next_milestone_date ?? '' : '',
    status: src.status as ProjectStatus,
    health: src.health as Health,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const open = () => {
    setF({
      summary: src.summary ?? '',
      objective: target.kind === 'project' ? target.project.objective ?? '' : '',
      statusNote: target.kind === 'project' ? target.project.status_note ?? '' : '',
      next: src.next_action ?? '',
      blocker: src.blocker ?? '',
      milestone: src.next_milestone ?? '',
      milestoneDate: target.kind === 'project' ? target.project.next_milestone_date ?? '' : '',
      status: src.status,
      health: src.health,
    });
    setEditing(true);
  };

  const save = () => {
    const common = {
      summary: f.summary.trim() || null,
      next_action: f.next.trim() || null,
      blocker: f.blocker.trim() || null,
      next_milestone: f.milestone.trim() || null,
      status: f.status,
      health: f.health,
    };
    if (target.kind === 'project') {
      api.updateProject(target.project.id, { ...common, objective: f.objective.trim() || null, status_note: f.statusNote.trim() || null, next_milestone_date: f.milestone.trim() ? f.milestoneDate || null : null });
    } else {
      api.updateWorkstream(target.ws.id, common);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <section className="rg-card pj-brief" aria-label="Edit brief">
        <div className="td-form">
          <label className="td-field td-field--wide">
            <span className="rg-label">{t.hq.summary}</span>
            <textarea className="td-input td-input--area" rows={3} value={f.summary} onChange={(e) => set('summary', e.target.value)} />
            <span className="rg-small rg-muted">{t.hq.editHint}</span>
          </label>
          {target.kind === 'project' && (
            <>
              <label className="td-field td-field--wide"><span className="rg-label">{t.hq.objective}</span><textarea className="td-input td-input--area" rows={2} value={f.objective} onChange={(e) => set('objective', e.target.value)} /></label>
              <label className="td-field td-field--wide"><span className="rg-label">{t.hq.current}</span><textarea className="td-input td-input--area" rows={2} value={f.statusNote} onChange={(e) => set('statusNote', e.target.value)} /></label>
            </>
          )}
          <label className="td-field td-field--wide"><span className="rg-label">{t.hq.next}</span><input className="td-input" value={f.next} onChange={(e) => set('next', e.target.value)} /></label>
          <label className="td-field td-field--wide"><span className="rg-label">{t.hq.blocker}</span><input className="td-input" value={f.blocker} onChange={(e) => set('blocker', e.target.value)} /></label>
          <label className="td-field"><span className="rg-label">{t.hq.milestone}</span><input className="td-input" value={f.milestone} onChange={(e) => set('milestone', e.target.value)} /></label>
          {target.kind === 'project' && (
            <label className="td-field"><span className="rg-label">{t.hq.milestoneDate}</span><input className="td-input" type="date" value={f.milestoneDate} onChange={(e) => set('milestoneDate', e.target.value)} /></label>
          )}
          <label className="td-field">
            <span className="rg-label">{t.hq.statusLabel}</span>
            <select className="td-input" value={f.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
              {Object.entries(t.projectsPage.statuses).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="td-field">
            <span className="rg-label">{t.hq.manualHealth}</span>
            <select className="td-input" value={f.health} onChange={(e) => set('health', e.target.value as Health)}>
              {Object.entries(t.projectsPage.healths).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <div className="td-modal__foot">
          <span className="td-modal__spacer" />
          <button className="rg-btn rg-btn--glass" onClick={() => setEditing(false)}>{t.hq.cancel}</button>
          <button className="rg-btn" onClick={save}>{t.hq.save}</button>
        </div>
      </section>
    );
  }

  const next = assessment.next;
  const milestoneDate = target.kind === 'project' ? target.project.next_milestone_date : null;
  return (
    <section className="rg-card pj-brief" aria-label="Brief">
      <button className="td-link pj-brief__edit" onClick={open}><Pencil size={14} /> {t.hq.edit}</button>
      <div className="pj-brief__grid">
        {target.kind === 'project' && has(target.project.objective) && <Cell label={t.hq.objective}><Text v={target.project.objective} /></Cell>}
        {has(target.kind === 'project' ? target.project.status_note : target.ws.summary) && (
          <Cell label={t.hq.current}><Text v={target.kind === 'project' ? target.project.status_note : target.ws.summary} /></Cell>
        )}
        <Cell label={t.hq.next} accent>
          {next ? <>{next.text}{next.from === 'task' && <span className="rg-small rg-muted pj-brief__from"> · {t.hq.from}</span>}</> : <span className="rg-muted">{t.hq.notSet}</span>}
        </Cell>
        {has(src.blocker) && <Cell label={t.hq.blocker}><Text v={src.blocker} /></Cell>}
        <Cell label={t.hq.milestone}>
          <Text v={src.next_milestone} />
          {src.next_milestone && milestoneDate && <span className="rg-small rg-muted"> · {t.fmtDate(milestoneDate)}</span>}
          {target.kind === 'project' && src.next_milestone && (
            <button className="td-pill pj-brief__reach" onClick={() => api.reachMilestone(target.project.id)}>{t.hq.milestoneReached}</button>
          )}
        </Cell>
      </div>
      {assessment.signals.length > 0 && (
        <div className="pj-brief__notice">
          <h3 className="rg-label">{t.hq.attentionTitle}</h3>
          <ul>{assessment.signals.map((s) => <li key={s.code} className="rg-small">{t.hq.signal(s)}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
