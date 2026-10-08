import { formatLondonTime } from '../../domain/london';
import type { CalendarEvent } from '../../domain/types';
import type { CalendarProblem } from '../../state/useUpcomingEvents';
import { t } from '../../strings';

const MAX_SHOWN = 8;

/** Today's remaining meetings, in London time: title, start and end, and the place when there is one. */
export function UpcomingEvents({ events, now, error }: { events: CalendarEvent[]; now: Date; error: CalendarProblem }) {
  const shown = events.slice(0, MAX_SHOWN);
  const later = events.length - shown.length;
  const problem = error ? t.comingUp.problem[error] : null;
  return (
    <section className="rg-glass td-coming" aria-labelledby="coming-title">
      <h2 className="rg-h2" id="coming-title">{t.comingUp.title}</h2>
      {problem && events.length === 0 ? (
        <p className="td-empty" role="status">{problem}</p>
      ) : events.length === 0 ? (
        <p className="td-empty">{t.comingUp.empty}</p>
      ) : (
        <>
          <ol className="td-events">
            {shown.map((e) => {
              const started = new Date(e.start).getTime() <= now.getTime();
              const mins = Math.max(0, Math.ceil((new Date(e.start).getTime() - now.getTime()) / 60_000));
              return (
                <li key={e.id} className="td-event" data-now={started}>
                  <time className="td-event__time" dateTime={e.start}>{formatLondonTime(e.start)}</time>
                  <div>
                    <p className="td-event__title">{started && <span className="rg-dot rg-dot--sm rg-dot--rose" aria-hidden />}{e.title}</p>
                    <p className="rg-small td-event__meta">
                      {started ? t.comingUp.now : t.comingUp.inMinutes(mins)}
                      {` · ${t.comingUp.until(formatLondonTime(e.end))}`}
                      {e.location ? ` · ${e.location}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          {later > 0 && <p className="rg-small">{t.comingUp.more(later)}</p>}
          {problem && <p className="rg-small" role="status">{problem}</p>}
        </>
      )}
    </section>
  );
}
