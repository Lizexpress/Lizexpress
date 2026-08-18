import { feedbackRepository } from '../repositories/admin.repository.js';
import uploadService from '../services/upload.service.js';
import { ok, created } from '../lib/response.js';
import { asyncHandler } from '../lib/errors.js';
import env from '../config/env.js';

export const health = (_req, res) =>
  ok(res, {
    status: 'ok',
    service: 'lizexpress-api',
    version: '2.0.0',
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });

export const testimonials = asyncHandler(async (_req, res) => ok(res, await feedbackRepository.testimonials(12)));

export const submitFeedback = asyncHandler(async (req, res) =>
  created(
    res,
    await feedbackRepository.create({
      user_id: req.auth?.id ?? null,
      type: req.body.type,
      rating: req.body.rating,
      message: req.body.message,
      page_url: req.body.pageUrl,
      is_testimonial: req.body.type === 'testimonial',
      status: 'new',
    }),
  ),
);

export const uploadImage = asyncHandler(async (req, res) =>
  created(
    res,
    await uploadService.uploadImage({
      userId: req.auth.id,
      file: req.file,
      folder: req.query.folder === 'avatar' ? 'avatars' : 'items',
    }),
  ),
);
