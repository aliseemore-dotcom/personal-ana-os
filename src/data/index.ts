import { hasSupabase } from '../config';
import { createLocalRepository } from './localRepository';
import { supabase } from './supabaseClient';
import { createSupabaseRepository } from './supabaseRepository';
import type { Repository } from './repository';

export type { Repository } from './repository';
export { supabase } from './supabaseClient';

/** Supabase when configured, otherwise the local demo store. */
export function createRepository(): Repository {
  return hasSupabase && supabase ? createSupabaseRepository(supabase) : createLocalRepository();
}
