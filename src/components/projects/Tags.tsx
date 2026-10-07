import type { Health, ProjectCategory, ProjectStatus } from '../../domain/types';
import { t } from '../../strings';

export function StatusTag({ status }: { status: ProjectStatus }) {
  const cls = status === 'active' ? 'rg-tag--rose' : status === 'waiting' ? 'rg-tag--warning' : status === 'completed' ? 'rg-tag--success' : '';
  return <span className={`rg-tag ${cls}`}>{t.projectsPage.statuses[status]}</span>;
}

/** Health is quiet when fine, warm when it needs a look, and strong only when blocked. */
export function HealthTag({ health }: { health: Health }) {
  const cls = health === 'blocked' ? 'rg-tag--danger' : health === 'needs_attention' ? 'rg-tag--warning' : '';
  return (
    <span className={`rg-tag ${cls}`}>
      {health === 'on_track' ? <span className="rg-dot rg-dot--sm rg-dot--success" /> : <span className="rg-tag__dot" />}
      {t.projectsPage.healths[health]}
    </span>
  );
}

export function CategoryTag({ category }: { category: ProjectCategory }) {
  return <span className="rg-tag">{t.projectsPage.categories[category]}</span>;
}
