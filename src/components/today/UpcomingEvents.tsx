import { config } from '../../config';
import type { CalendarEvent } from '../../domain/types';
import type { CalendarProblem } from '../../state/useUpcomingEvents';
import { t } from '../../strings';

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString(config.locale, { hour: '2-digit', minute: '2-digit', hour12: false });

export function UpcomingEvents({ events, now, error }: { events: CalendarEvent[]; now: Date; error: CalendarProblem }) {
  return (
    <section className="rg-glass td-coming" aria-labelledby="coming-title">
      <h2 className="rg-h2" id="coming-title">{t.comingUp.title}</h2>
      {error && events.length === 0 ? (
        <p className="td-empty">{error === 'not_connected' ? t.comingUp.notConnected : t.comingUp.error}</p>
      ) : events.length === 0 ? (
        <p className="td-empty">{t.comingUp.empty(config.comingUpHours)}</p>
      ) : (
        <ol className="td-events">
          {events.map((e) => {
            const started = new Date(e.start).getTime() <= now.getTime();
            const mins = Math.max(0, Math.ceil((new Date(e.start).getTime() - now.getTime()) / 60_000));
            return (
              <li key={e.id} className="td-event" data-now={started}>
                <time className="td-event__time">{hhmm(e.start)}</time>
                <div>
                  <p className="td-event__title">{started && <span className="rg-dot rg-dot--sm rg-dot--rose" aria-hidden />}{e.title}</p>
                  <p className="rg-small td-event__meta">
                    {started ? t.comingUp.now : t.comingUp.inMinutes(mins)}
                    {e.location ? ` · ${e.location}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
