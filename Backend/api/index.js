/**
 * Vercel entry point.
 *
 * The whole Express app runs inside one serverless function. Vercel's Node
 * runtime invokes the default export with a standard (req, res) pair, so an
 * Express app *is* a valid handler — no adapter such as serverless-http is
 * needed, and the same code path runs locally and in production.
 *
 * Alternatives considered and rejected:
 *   - one function per route: duplicated middleware, N cold starts, no shared router
 *   - Edge runtime: no Node APIs, so the Supabase/Resend/web-push SDKs cannot run
 *
 * Routing is handled by vercel.json, which rewrites every path here. The
 * original URL is preserved, so the Express router sees /api/v1/... unchanged.
 */
import app from '../src/app.js';

export default app;
