import type { Route } from '../state/useRoute';
import { t } from '../strings';

const ROUTES: Route[] = ['today', 'tasks', 'projects'];

export function AppNav({ route, onNavigate }: { route: Route; onNavigate: (hash: string) => void }) {
  return (
    <nav className="rg-tabs td-nav" role="tablist" aria-label={t.nav.label}>
      {ROUTES.map((r) => (
        <button key={r} className="rg-tab" role="tab" aria-selected={route === r} onClick={() => onNavigate(r)}>
          {t.nav[r]}
        </button>
      ))}
    </nav>
  );
}
