const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day key, YYYY-MM-DD. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds());
}

export const MS_DAY = 86_400_000;

/** Whole calendar days from a to b (negative if b is earlier). */
export function calendarDaysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / MS_DAY);
}

/** Mon–Fri days elapsed after `from`'s day up to and including `to`'s day. */
export function workingDaysBetween(from: Date, to: Date): number {
  const total = calendarDaysBetween(from, to);
  let count = 0;
  for (let i = 1; i <= total; i++) {
    const day = addDays(from, i).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export function nextMonday(d: Date): Date {
  const delta = ((8 - d.getDay()) % 7) || 7;
  return addDays(startOfDay(d), delta);
}

export function dayOfYear(d: Date): number {
  return calendarDaysBetween(new Date(d.getFullYear(), 0, 1), d);
}
