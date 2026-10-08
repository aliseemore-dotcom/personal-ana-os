/**
 * "Today" for the calendar is London's today, whatever timezone the browser or the server is in.
 * Uses the platform's timezone database, so British Summer Time changes are handled.
 */
export const LONDON = 'Europe/London';

const wall = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function wallClock(at: Date) {
  const p = Object.fromEntries(wall.formatToParts(at).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Minutes London is ahead of UTC at that instant (0 in winter, 60 in summer). */
export function londonOffsetMinutes(at: Date): number {
  const w = wallClock(at);
  return (Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(at.getTime() / 1000) * 1000) / 60_000;
}

/** London's calendar day for an instant, as YYYY-MM-DD. */
export function londonDayKey(at: Date): string {
  const w = wallClock(at);
  return `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
}

/** The instant London's clock first reads 00:00 on that day. */
export function londonStartOfDay(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  let t = Date.UTC(y, m - 1, d);
  const first = londonOffsetMinutes(new Date(t));
  t -= first * 60_000;
  const second = londonOffsetMinutes(new Date(t)); // the offset may change across that instant (clock change days)
  if (second !== first) t -= (second - first) * 60_000;
  return new Date(t);
}

/** [start of London's day, start of the next one) for the day containing `at`. Days can be 23 or 25 hours long. */
export function londonDayRange(at: Date): { from: Date; to: Date } {
  const key = londonDayKey(at);
  const from = londonStartOfDay(key);
  const next = londonDayKey(new Date(from.getTime() + 36 * 3_600_000));
  return { from, to: londonStartOfDay(next) };
}

const clock = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "15:00" in London time. */
export const formatLondonTime = (at: Date | string): string => clock.format(typeof at === 'string' ? new Date(at) : at);
