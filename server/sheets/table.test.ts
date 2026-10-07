import { describe, expect, it } from 'vitest';
import { columnLetter, findColumn, parseBool, parseDate, parseDeadline, parseInt0, parseString, parseTable, parseTimestamp, slug, toCell } from './table.js';

describe('header matching', () => {
  it('normalises header names and finds columns by name or alias, wherever they are', () => {
    const t = parseTable([['Task ID', ' Title ', 'Scheduled Date'], ['TASK-1', 'x', '']]);
    expect(t.headers).toEqual(['task_id', 'title', 'scheduled_date']);
    expect(findColumn(t.headers, ['nope', 'scheduled_date'])).toBe(2);
    expect(findColumn(t.headers, ['missing'])).toBe(-1);
  });
  it('skips blank rows and keeps real row numbers', () => {
    const t = parseTable([['a'], ['x'], [''], ['y']]);
    expect(t.rows.map((r) => r.rowNumber)).toEqual([2, 4]);
  });
  it('makes column letters', () => {
    expect([0, 25, 26, 27, 701, 702].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  });
  it('slugs statuses people type by hand', () => {
    expect(['In Progress ', 'in-progress', 'IN_PROGRESS'].map(slug)).toEqual(['in_progress', 'in_progress', 'in_progress']);
  });
});

describe('tolerant values', () => {
  it('treats blanks as null, never as "undefined" or NaN', () => {
    expect([parseString(''), parseString('  '), parseString(undefined), parseInt0(''), parseInt0('abc'), parseBool(''), parseDate(''), parseDate('not a date')]).toEqual([null, null, null, null, null, null, null, null]);
  });
  it('reads booleans and numbers however they were typed', () => {
    expect([true, 'TRUE', 'yes', 1, '0', 'No', 'maybe'].map(parseBool)).toEqual([true, true, true, true, false, false, null]);
    expect([45, '30 min', '1,5'.length].map(parseInt0)).toEqual([45, 30, 3]);
  });
  it('reads dates from serial numbers, ISO and day-first text', () => {
    expect(parseDate(46302)?.day).toBe('2026-10-07'); // Sheets serial for 7 Oct 2026
    expect(parseDate(46302.5)?.iso).toBe('2026-10-07T12:00:00.000Z');
    expect(parseDate('2026-10-07')?.day).toBe('2026-10-07');
    expect(parseDate('2026-10-07T09:30:00Z')?.iso).toBe('2026-10-07T09:30:00.000Z');
    expect(parseDate('07/10/2026')?.day).toBe('2026-10-07');
    expect(parseDate('15 Oct 2026')?.day).toBe('2026-10-15');
  });
  it('turns a date-only deadline into the end of that day, without an offset', () => {
    expect(parseDeadline('2026-10-07')).toBe('2026-10-07T23:59:59');
    expect(parseDeadline(46302)).toBe('2026-10-07T23:59:59');
    expect(parseTimestamp('2026-10-07')).toBe('2026-10-07T12:00:00.000Z');
  });
  it('writes values the sheet can keep as they are', () => {
    expect([toCell('bool', true), toCell('str', null), toCell('date', '2026-10-07T00:00:00Z'), toCell('int', '5'), toCell('deadline', '2026-10-07')]).toEqual([true, '', '2026-10-07', 5, '2026-10-07']);
  });
});
