import { config } from '../../config';
import type { Weather } from '../../services/weather';
import { t } from '../../strings';

export function Header({ now, weather, onSignOut }: { now: Date; weather: Weather | null; onSignOut?: () => void }) {
  const date = now.toLocaleDateString(config.locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const time = now.toLocaleTimeString(config.locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <header className="td-header">
      <div>
        <h1 className="td-date">{date}</h1>
        <p className="td-greeting">{t.greeting(now.getHours(), config.userName)}</p>
      </div>
      <div className="td-clock">
        <time className="rg-metric__value td-time" dateTime={now.toISOString()}>
          {time}
        </time>
        <p className="td-weather" aria-live="off">
          {weather ? `${weather.temperatureC}°C · ${weather.summary}` : ' '}
        </p>
        {onSignOut && (
          <button className="td-link" onClick={onSignOut}>
            {t.auth.signOut}
          </button>
        )}
      </div>
    </header>
  );
}
