import type { Project } from '../../domain/types';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const initials = (name: string) =>
  name.replace(/&/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/**
 * v1 placeholder: the brand's pink sky with one glass sphere, placed differently per project
 * so each area is recognisable. A real `cover_image` replaces it when one is set.
 */
export function Cover({ project, size = 'card' }: { project: Pick<Project, 'id' | 'name' | 'cover_image'>; size?: 'card' | 'hq' }) {
  if (project.cover_image) return <img className={`pj-cover pj-cover--${size}`} src={project.cover_image} alt="" />;
  const h = hash(project.id);
  const style = {
    '--orb-x': `${15 + (h % 60)}%`,
    '--orb-y': `${10 + ((h >> 3) % 50)}%`,
    '--orb-s': `${44 + ((h >> 6) % 30)}%`,
  } as React.CSSProperties;
  return (
    <div className={`pj-cover pj-cover--${size}`} style={style} aria-hidden>
      <span className="rg-orb pj-cover__orb" />
      <span className="pj-cover__initials">{initials(project.name)}</span>
    </div>
  );
}
