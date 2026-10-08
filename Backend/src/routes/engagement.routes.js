import { Router } from 'express';
import * as controller from '../controllers/engagement.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { engagementSchemas as schemas } from '../validators/engagement.validators.js';
import rateLimit from 'express-rate-limit';
import { TooManyRequests } from '../lib/errors.js';

const router = Router();

// Comments are public text — a per-account ceiling stops one account flooding a vendor's page.
const commentLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 20,
  keyGenerator: (req) => `comment:${req.auth?.id ?? req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => next(TooManyRequests('You are commenting very quickly. Please wait a few minutes.')),
});

/* Specific paths first, so "state", "mine" and "comments" are never read as a type. */
router.get('/state', requireAuth, validate({ query: schemas.state }), controller.viewerState);
router.get('/mine', requireAuth, validate({ query: schemas.overview }), controller.mine);
router.delete('/comments/:commentId', requireAuth, validate({ params: schemas.commentId }), controller.deleteComment);

router.get('/:type/:id', optionalAuth, validate({ params: schemas.target }), controller.state);
router.post('/:type/:id/like', requireAuth, validate({ params: schemas.target }), controller.like);
router.post('/:type/:id/save', requireAuth, validate({ params: schemas.target }), controller.save);
router.post('/:type/:id/share', optionalAuth, validate({ params: schemas.target }), controller.share);
router.get('/:type/:id/comments', validate({ params: schemas.target, query: schemas.comments }), controller.comments);
router.post(
  '/:type/:id/comments',
  requireAuth,
  commentLimiter,
  validate({ params: schemas.target, body: schemas.comment }),
  controller.addComment,
);

export default router;
