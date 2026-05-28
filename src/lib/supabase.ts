/**
 * Backward-compatible re-export hub.
 *
 * WHY: All existing client-side imports of `@/lib/supabase` continue to work
 * without modification. Only the public `supabase` client is re-exported from here.
 * API routes and server-side code must import directly from `@/lib/supabaseAdmin`.
 */
export { supabase } from './supabaseClient';
