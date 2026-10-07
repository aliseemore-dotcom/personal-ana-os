import { config } from '../../config';
import { supabase } from '../../data';
import { CalendarService } from './calendarService';
import { createGoogleCalendarProvider } from './googleProvider';
import { createMockCalendarProvider } from './mockProvider';
import type { CalendarProvider } from './types';

export { CalendarService } from './calendarService';
export type { CalendarProvider } from './types';

function pickProvider(): CalendarProvider {
  if (config.calendarProvider === 'google') {
    return createGoogleCalendarProvider(async () => {
      const { data } = (await supabase?.auth.getSession()) ?? { data: null };
      return data?.session?.provider_token ?? null;
    });
  }
  return createMockCalendarProvider();
}

export const calendarService = new CalendarService(pickProvider());
