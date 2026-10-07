const env = import.meta.env;

export const config = {
  userName: (env.VITE_USER_NAME as string) || 'Anastasija',
  locale: (env.VITE_LOCALE as string) || 'en-GB',
  supabaseUrl: (env.VITE_SUPABASE_URL as string) || '',
  supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY as string) || '',
  weather: {
    lat: Number(env.VITE_WEATHER_LAT ?? 51.5072),
    lon: Number(env.VITE_WEATHER_LON ?? -0.1276),
  },
  calendarProvider: ((env.VITE_CALENDAR_PROVIDER as string) || 'mock') as 'mock' | 'google',
  /** How far ahead "Coming up" looks. */
  comingUpHours: 4,
};

export const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey);
