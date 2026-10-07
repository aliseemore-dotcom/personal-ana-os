import { useEffect, useState } from 'react';

export type Route = 'today' | 'tasks';

const read = (): Route => (window.location.hash === '#tasks' ? 'tasks' : 'today');

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [route, (r) => { window.location.hash = r === 'tasks' ? '#tasks' : '#today'; setRoute(r); }];
}
