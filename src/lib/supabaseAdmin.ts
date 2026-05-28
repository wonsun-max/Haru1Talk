import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!supabaseServiceKey) {
  logger.warn('SUPABASE_SERVICE_ROLE_KEY is missing. Admin client will fall back to anon key — some operations may fail.');
}

/**
 * Admin-privileged Supabase client for server-side API routes ONLY.
 *
 * WHY: Uses the service role key to bypass Row Level Security for administrative operations
 * (e.g. user verification, background diary summarization, cron notifications).
 * NEVER import this file in client components — 'server-only' enforces this at compile time.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
