import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// WHY: Warn at init time if public env vars are missing, without crashing the build.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  logger.warn('Supabase URL or Anonymous Key is missing. Using placeholder fallbacks.');
}

/**
 * Public Supabase client for use in Client Components and client-side pages.
 *
 * WHY: Uses the anon key only. Respects Row Level Security policies.
 * Safe to import in 'use client' components.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
