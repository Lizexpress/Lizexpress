import verificationService from '../services/verification.service.js';
import uploadService from '../services/upload.service.js';
import { ok, created, paginated } from '../lib/response.js';
import { asyncHandler } from '../lib/errors.js';
import { requestContext as context } from '../lib/clientIp.js';

/* Applicant */
export const submit = asyncHandler(async (req, res) =>
  created(res, await verificationService.submit({ userId: req.auth.id, payload: req.body })),
);

export const myStatus = asyncHandler(async (req, res) =>
  ok(res, await verificationService.myStatus(req.auth.id)),
);

/** Documents go straight to the private bucket; only the storage path is returned. */
export const uploadDocument = asyncHandler(async (req, res) =>
  created(
    res,
    await uploadService.uploadDocument({
      userId: req.auth.id,
      file: req.file,
      kind: req.params.kind,
    }),
  ),
);

/* Reviewer */
export const queue = asyncHandler(async (req, res) => {
  const { items, total, page, limit } = await verificationService.queue(req.validatedQuery);
  paginated(res, items, { page, limit, total });
});

export const detail = asyncHandler(async (req, res) => ok(res, await verificationService.detail(req.params.id)));

export const claim = asyncHandler(async (req, res) =>
  ok(res, await verificationService.claim({ id: req.params.id, reviewerId: req.auth.id })),
);

export const decide = asyncHandler(async (req, res) =>
  ok(
    res,
    await verificationService.decide({
      id: req.params.id,
      reviewerId: req.auth.id,
      ...req.body,
      request: context(req),
    }),
  ),
);

export const requestResubmission = asyncHandler(async (req, res) =>
  ok(
    res,
    await verificationService.requestResubmission({
      id: req.params.id,
      reviewerId: req.auth.id,
      notes: req.body.notes,
      request: context(req),
    }),
  ),
);

export const stats = asyncHandler(async (_req, res) => ok(res, await verificationService.stats()));
