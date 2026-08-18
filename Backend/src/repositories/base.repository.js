/**
 * Shared query helpers.
 * Repositories are the ONLY layer allowed to import the Supabase client —
 * services stay free of PostgREST syntax, which keeps them testable and
 * makes a future datastore change a contained edit.
 */
import { adminClient, unwrap } from '../lib/supabase.js';
import { PAGINATION } from '../config/constants.js';

export const db = adminClient;
export { unwrap };

export const range = ({ page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT }) => {
  const safeLimit = Math.min(Number(limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const safePage = Math.max(Number(page) || 1, 1);
  const from = (safePage - 1) * safeLimit;
  return { from, to: from + safeLimit - 1, page: safePage, limit: safeLimit };
};

/** Strips undefined so a partial update never nulls a column by accident. */
export const compact = (object) =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
