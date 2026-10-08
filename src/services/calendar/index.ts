import { config } from '../../config';
import { getAccessKey, setAccessKey } from '../../data/accessKey';
import { createApiCalendarProvider } from './apiProvider';
import { CalendarService } from './calendarService';
import { createMockCalendarProvider } from './mockProvider';
import type { CalendarProvider } from './types';

export { CalendarService } from './calendarService';
export { CalendarUnavailable, type CalendarProblemKind } from './apiProvider';
export type { CalendarProvider } from './types';

/**
 * Demo events are for the local demo only. With the Data Hub as the data source the calendar comes
 * from Google (through /api/calendar), and invented events are never shown unless asked for explicitly.
 */
function pickProvider(): CalendarProvider {
  return config.calendarProvider === 'api'
    ? createApiCalendarProvider({ getKey: getAccessKey, onUnauthorised: () => setAccessKey(null) })
    : createMockCalendarProvider();
}

export const calendarService = new CalendarService(pickProvider());
