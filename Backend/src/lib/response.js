/**
 * Every successful response has the same envelope so the web app and the mobile
 * app can share one HTTP client and one parser.
 *
 *   { success: true, data: <payload>, meta?: {...} }
 */
export const ok = (res, data, meta) =>
  res.status(200).json({ success: true, data, ...(meta ? { meta } : {}) });

export const created = (res, data, meta) =>
  res.status(201).json({ success: true, data, ...(meta ? { meta } : {}) });

export const accepted = (res, data) => res.status(202).json({ success: true, data });

export const noContent = (res) => res.status(204).send();

export const paginated = (res, items, { page, limit, total }) =>
  res.status(200).json({
    success: true,
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });
