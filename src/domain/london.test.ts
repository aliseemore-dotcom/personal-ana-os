import { describe, expect, it } from 'vitest';
import { formatLondonTime, londonDayKey, londonDayRange, londonOffsetMinutes, londonStartOfDay } from './london';

describe('London time', () => {
  it('knows summer and winter offsets', () => {
    expect(londonOffsetMinutes(new Date('2026-10-08T12:00:00Z'))).toBe(60); // BST
    expect(londonOffsetMinutes(new Date('2026-12-08T12:00:00Z'))).toBe(0); // GMT
  });
  it('formats an instant in London whatever the machine timezone is', () => {
    expect(formatLondonTime('2026-10-08T14:00:00Z')).toBe('15:00');
    expect(formatLondonTime('2026-12-08T14:00:00Z')).toBe('14:00');
    expect(formatLondonTime('2026-10-08T23:30:00Z')).toBe('00:30');
  });
  it('finds London’s day from an instant near midnight', () => {
    expect(londonDayKey(new Date('2026-10-08T22:59:00Z'))).toBe('2026-10-08'); // 23:59 BST
    expect(londonDayKey(new Date('2026-10-08T23:00:00Z'))).toBe('2026-10-09'); // 00:00 BST next day
    expect(londonDayKey(new Date('2026-12-08T23:30:00Z'))).toBe('2026-12-08'); // GMT: same day
  });
  it('starts London’s day at the right instant', () => {
    expect(londonStartOfDay('2026-10-08').toISOString()).toBe('2026-10-07T23:00:00.000Z');
    expect(londonStartOfDay('2026-12-08').toISOString()).toBe('2026-12-08T00:00:00.000Z');
  });
  it('gives 24-hour days normally and 23 or 25 hours on clock-change days', () => {
    const hours = (iso: string) => { const r = londonDayRange(new Date(iso)); return (r.to.getTime() - r.from.getTime()) / 3_600_000; };
    expect(hours('2026-10-08T12:00:00Z')).toBe(24);
    expect(hours('2026-03-29T12:00:00Z')).toBe(23); // clocks go forward
    expect(hours('2026-10-25T12:00:00Z')).toBe(25); // clocks go back
  });
  it('day ranges are contiguous', () => {
    const a = londonDayRange(new Date('2026-10-24T12:00:00Z'));
    const b = londonDayRange(new Date('2026-10-25T12:00:00Z'));
    expect(a.to.getTime()).toBe(b.from.getTime());
  });
});
