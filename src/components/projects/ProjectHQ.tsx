import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Project } from '../../domain/types';
import { assessProject, assessWorkstream } from '../../logic/projectHealth';
import { DEFAULT_THRESHOLDS } from '../../logic/thresholds';
import { useProjects } from '../../state/ProjectsProvider';
import { useTasks } from '../../state/TasksProvider';
import { t } from '../../strings';
import { TaskDetail } from '../tasks/TaskDetail';
import { Brief } from './Brief';
import { Cover } from './Cover';
import { DecisionsSection, DocumentsSection, NotesSection, PeopleSection, TasksSection, TimelineSection, type Scope } from './Sections';
import { CategoryTag, HealthTag, StatusTag } from './Tags';
import { Workstreams } from './Workstreams';

type Section = keyof typeof t.hq.sections;
const SECTIONS: Section[] = ['tasks', 'people', 'decisions', 'notes', 'documents', 'timeline'];

/** One project, or one workstream inside it: an executive brief first, then the shared records. */
export function ProjectHQ({ project, workstreamId, now }: { project: Project; workstreamId: string | null; now: Date }) {
  const P = useProjects();
  const T = useTasks();
  const [section, setSection] = useState<Section>('tasks');
  const [openId, setOpenId] = useState<string | null>(null);

  const siblings = useMemo(() => P.workstreams.filter((w) => w.project_id === project.id), [P.workstreams, project.id]);
  const ws = workstreamId ? siblings.find((w) => w.id === workstreamId) ?? null : null;
  const tasks = T.tasks.filter((x) => x.project_id === project.id);
  const assessment = useMemo(
    () => (ws ? assessWorkstream(ws, tasks.filter((x) => x.workstream_id === ws.id), now, DEFAULT_THRESHOLDS) : assessProject(project, tasks, siblings, now, DEFAULT_THRESHOLDS)),
    [ws, project, tasks, siblings, now], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const openTask = openId ? T.tasks.find((x) => x.id === openId) : undefined;
  const scope: Scope = { project, ws, now, openTask: setOpenId };
  const status = ws ? ws.status : project.status;
  const noun = t.hq.nouns[project.workstream_kind];

  return (
    <>
      <nav className="pj-crumbs" aria-label="Breadcrumb">
        <a className="td-link" href="#projects">{t.hq.back}</a>
        <ChevronRight size={14} aria-hidden />
        {ws ? <a className="td-link" href={`#projects/${project.id}`}>{project.name}</a> : <span>{project.name}</span>}
        {ws && (<><ChevronRight size={14} aria-hidden /><span>{ws.name}</span></>)}
      </nav>

      <header className="rg-glass pj-head">
        <Cover project={project} size="hq" />
        <div className="pj-head__main">
          <h1 className="pj-head__name">{ws ? ws.name : project.name}</h1>
          <div className="pj-card__tags">
            <CategoryTag category={project.category} />
            <StatusTag status={status} />
            {status !== 'completed' && <HealthTag health={assessment.health} />}
          </div>
          {!ws && project.summary && <p className="pj-head__summary">{project.summary}</p>}
          {ws && <p className="rg-small">{t.hq.scopeHint(ws.name)}</p>}
        </div>
      </header>

      {ws && siblings.length > 1 && (
        <div className="pj-siblings" role="group" aria-label={noun.title}>
          {siblings.filter((w) => w.status !== 'completed' || w.id === ws.id).map((w) => (
            <a key={w.id} className="tk-chip" href={`#projects/${project.id}/${w.id}`} aria-pressed={w.id === ws.id}>{w.name}</a>
          ))}
        </div>
      )}

      <Brief key={ws?.id ?? project.id} target={ws ? { kind: 'workstream', ws, project } : { kind: 'project', project }} assessment={assessment} />

      {!ws && <Workstreams project={project} items={siblings} tasks={tasks} now={now} />}

      <section className="pj-sections" aria-label="Project records">
        <div className="rg-tabs pj-tabs" role="tablist">
          {SECTIONS.map((s) => (
            <button key={s} className="rg-tab" role="tab" aria-selected={section === s} onClick={() => setSection(s)}>{t.hq.sections[s]}</button>
          ))}
        </div>
        <div className="rg-card pj-panel" role="tabpanel">
          {section === 'tasks' && <TasksSection scope={scope} />}
          {section === 'people' && <PeopleSection scope={scope} />}
          {section === 'decisions' && <DecisionsSection scope={scope} />}
          {section === 'notes' && <NotesSection scope={scope} />}
          {section === 'documents' && <DocumentsSection scope={scope} />}
          {section === 'timeline' && <TimelineSection scope={scope} />}
        </div>
      </section>

      {openTask && <TaskDetail key={openTask.id} task={openTask} now={now} onClose={() => setOpenId(null)} />}
    </>
  );
}
