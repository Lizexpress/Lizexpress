/**
 * Two clients, two very different trust levels.
 *
 *  adminClient  — service-role key. Bypasses RLS. Server-side only, never leaves this process.
 *  anonClient   — anon key. Used for password sign-in and token verification.
 *  userClient() — anon key + the caller's access token, so RLS still applies to their reads.
 *
 * Keeping them separate makes privilege escalation an explicit, greppable choice.
 */
import { createClient } from '@supabase/supabase-js';
import env from '../config/env.js';

const baseOptions = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
};

export const adminClient = createClient(env.supabase.url, env.supabase.serviceRoleKey, baseOptions);

export const anonClient = createClient(env.supabase.url, env.supabase.anonKey, baseOptions);

export const userClient = (accessToken) =>
  createClient(env.supabase.url, env.supabase.anonKey, {
    ...baseOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

/**
 * Normalises PostgREST errors into something the error middleware understands.
 * Call this on every query result rather than checking `error` by hand.
 */
export const unwrap = ({ data, error, count }, context = 'database operation') => {
  if (error) {
    const err = new Error(`${context} failed: ${error.message}`);
    err.status = error.code === 'PGRST116' ? 404 : 500;
    err.code = error.code ?? 'database_error';
    err.details = error.details ?? null;
    err.isOperational = true;
    throw err;
  }
  return count === undefined || count === null ? data : { data, count };
};
