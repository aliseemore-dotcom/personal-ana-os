import type { Route } from '../state/useRoute';
import { t } from '../strings';

export function AppNav({ route, onNavigate }: { route: Route; onNavigate: (r: Route) => void }) {
  return (
    <nav className="rg-tabs td-nav" role="tablist" aria-label={t.nav.label}>
      {(['today', 'tasks'] as Route[]).map((r) => (
        <button key={r} className="rg-tab" role="tab" aria-selected={route === r} onClick={() => onNavigate(r)}>
          {t.nav[r]}
        </button>
      ))}
    </nav>
  );
}
