import { useEffect, useState } from 'react';

export type Route = 'today' | 'tasks' | 'projects';
export interface Location {
  route: Route;
  /** Project id (and optional workstream id) when a Project HQ is open. */
  projectId: string | null;
  workstreamId: string | null;
}

function read(): Location {
  const [name, a, b] = window.location.hash.replace(/^#/, '').split('/');
  if (name === 'tasks') return { route: 'tasks', projectId: null, workstreamId: null };
  if (name === 'projects') return { route: 'projects', projectId: a || null, workstreamId: b || null };
  return { route: 'today', projectId: null, workstreamId: null };
}

/** Hash routes: #today, #tasks, #projects, #projects/<project>, #projects/<project>/<workstream>. */
export function useRoute(): [Location, (hash: string) => void] {
  const [loc, setLoc] = useState<Location>(read);
  useEffect(() => {
    const on = () => setLoc(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [loc, (hash) => { window.location.hash = hash; setLoc(read()); }];
}
