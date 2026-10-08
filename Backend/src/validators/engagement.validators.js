import { z } from 'zod';

const type = z.enum(['advert', 'item']);
const uuid = z.string().uuid('Invalid identifier.');

export const engagementSchemas = {
  target: z.object({ type, id: uuid }),
  commentId: z.object({ commentId: uuid }),

  comment: z.object({
    body: z.string().trim().min(1, 'Write a comment first.').max(1000, 'Keep comments under 1,000 characters.'),
    parentId: uuid.optional(),
  }),

  comments: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),

  /** ?type=item&ids=a,b,c — at most one page of cards. */
  state: z.object({
    type,
    ids: z
      .string()
      .transform((value) => value.split(',').map((part) => part.trim()).filter(Boolean))
      .pipe(z.array(uuid).max(60)),
  }),

  overview: z.object({ days: z.coerce.number().int().refine((value) => [7, 30, 90].includes(value), 'Choose 7, 30 or 90 days.').default(30) }),

  adminComments: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    hidden: z.enum(['true', 'false']).optional().transform((value) => (value === undefined ? undefined : value === 'true')),
  }),

  hide: z.object({ hidden: z.boolean() }),
};

export default engagementSchemas;
