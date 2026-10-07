import type { ProjectView } from '../../logic/projectViews';
import { t } from '../../strings';
import { Cover } from './Cover';
import { CategoryTag, HealthTag, StatusTag } from './Tags';

export function ProjectCard({ view }: { view: ProjectView }) {
  const { project, workstreams, assessment } = view;
  const done = project.status === 'completed';
  return (
    <li>
      <a className="rg-card pj-card" href={`#projects/${project.id}`} data-health={assessment.health} data-done={done}>
        <Cover project={project} />
        <div className="pj-card__body">
          <h3 className="pj-card__name">{project.name}</h3>
          <div className="pj-card__tags">
            <CategoryTag category={project.category} />
            <StatusTag status={project.status} />
            {!done && <HealthTag health={assessment.health} />}
          </div>
          <p className="rg-small pj-card__next">
            {assessment.next ? (
              <>
                <span className="rg-label">{t.projectsPage.next}</span> {assessment.next.text}
              </>
            ) : done ? null : (
              <span className="rg-muted">{t.projectsPage.noNext}</span>
            )}
          </p>
          {workstreams.length > 0 && <p className="rg-small rg-muted">{t.projectsPage.workstreamCount(workstreams.filter((w) => w.status !== 'completed').length, project.workstream_kind)}</p>}
        </div>
      </a>
    </li>
  );
}
