import { config, hasSupabase } from '../config';
import { getAccessKey, setAccessKey } from './accessKey';
import { createHttpRepository } from './httpRepository';
import { createLocalRepository } from './localRepository';
import { supabase } from './supabaseClient';
import { createSupabaseRepository } from './supabaseRepository';
import type { Repository } from './repository';

export type { Repository } from './repository';
export { supabase } from './supabaseClient';

/**
 * Which source of truth backs the UI (VITE_DATA_SOURCE):
 *   sheets   – the Google Sheets Data Hub, read and written through our own /api
 *   supabase – Supabase, when configured
 *   local    – demo data in this browser (development and the static preview)
 */
export function createRepository(): Repository {
  if (config.dataSource === 'sheets') {
    return createHttpRepository({
      getKey: getAccessKey,
      onUnauthorised: () => setAccessKey(null),
      extras: createLocalRepository({ demo: false }),
    });
  }
  return config.dataSource === 'supabase' && hasSupabase && supabase ? createSupabaseRepository(supabase) : createLocalRepository();
}
