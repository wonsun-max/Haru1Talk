import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';

// WHY: Graceful configuration verification during initialization to prevent obscure runtime crashes.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  logger.warn('Supabase URL or Anonymous Key is missing in environment variables. Using placeholder fallbacks for build/compilation safety.');
}

/**
 * Standard Supabase client for client-side and general server-side database actions.
 * 
 * WHY: Leverages the user's active session and honors standard Row Level Security (RLS) policies.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

/**
 * Admin-privileged Supabase client for backend/service-level actions bypassing Row Level Security.
 * 
 * WHY: Essential for critical operations such as profile trigger verification, background summaries,
 * or setup scripts. Crucial to run ONLY in server-side API routes to prevent credential leakage.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});
