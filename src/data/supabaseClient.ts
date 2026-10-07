import { createClient } from '@supabase/supabase-js';
import { config, hasSupabase } from '../config';

export const supabase = hasSupabase ? createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
