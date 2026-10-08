/**
 * Advertisement request schemas.
 *
 * Kept in their own file rather than appended to validators/index.js so the
 * advertising product line can be reviewed, versioned and removed as a unit.
 * Re-export from index.js with:  export * from './advert.validators.js';
 */
import { z } from 'zod';

const uuid = z.string().uuid('Invalid identifier.');

const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Nigerian numbers, tolerant of the formats people actually type. */
const phone = z
  .string()
  .trim()
  .regex(/^(\+?234|0)[789]\d{9}$/, 'Enter a valid Nigerian phone number.');

const advertBody = {
  businessName: z.string().trim().min(2, 'Enter your business name.').max(140),
  title: z.string().trim().min(3, 'Give your advert a clear headline.').max(140),
  description: z.string().trim().min(20, 'Describe your product or service in at least 20 characters.').max(4000),
  category: z.string().trim().min(2, 'Choose a category.').max(80),
  subcategory: z.string().trim().max(80).optional(),

  priceFrom: z.coerce.number().nonnegative().optional(),
  priceTo: z.coerce.number().nonnegative().optional(),
  priceNote: z.string().trim().max(140).optional(),

  contactPhone: phone,
  contactWhatsapp: phone.optional(),
  contactEmail: z.string().trim().toLowerCase().email('Enter a valid email address.').optional(),
  websiteUrl: z.string().trim().url('Enter a valid website address.').max(300).optional(),

  country: z.string().trim().max(80).default('Nigeria'),
  stateCode: z.string().trim().length(2, 'Choose a state.').optional(),
  state: z.string().trim().min(2, 'Choose a state.').max(80),
  lga: z.string().trim().min(2, 'Choose a local government area.').max(120),
  city: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
};

export const advertSchemas = {
  create: z.object(advertBody),
  update: z.object(advertBody).partial(),
  idParam: z.object({ id: uuid }),
  photoIdParam: z.object({ photoId: uuid }),

  addPhoto: z.object({ caption: z.string().trim().max(140).optional() }),

  /** Public search. Location filters narrow, they never widen. */
  search: pagination.extend({
    q: z.string().trim().max(140).optional(),
    category: z.string().trim().max(80).optional(),
    stateCode: z.string().trim().length(2).optional(),
    state: z.string().trim().max(80).optional(),
    lga: z.string().trim().max(120).optional(),
    city: z.string().trim().max(120).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    sort: z.enum(['newest', 'oldest', 'popular', 'price_low', 'price_high']).default('newest'),
  }),

  mine: pagination.extend({
    status: z.enum(['draft', 'pending_payment', 'active', 'expired', 'suspended', 'archived']).optional(),
  }),

  lgaQuery: z.object({ stateCode: z.string().trim().length(2, 'Choose a state.') }),

  adminList: pagination.extend({
    status: z
      .enum(['all', 'draft', 'pending_payment', 'active', 'expired', 'suspended', 'archived'])
      .default('all'),
    state: z.string().trim().max(80).optional(),
    search: z.string().trim().max(80).optional(),
  }),

  adminStatus: z.object({
    status: z.enum(['active', 'suspended', 'expired', 'archived']),
    reason: z.string().trim().max(500).optional(),
  }),
};

/** Onboarding — a user may pick swapping, advertising, or both. */
export const onboardingSchemas = {
  complete: z.object({
    accountTypes: z
      .array(z.enum(['swapper', 'advertiser']))
      .min(1, 'Choose at least one option to continue.')
      .max(2),
    business: z
      .object({
        name: z.string().trim().max(140).optional(),
        phone: phone.optional(),
        about: z.string().trim().max(500).optional(),
        state: z.string().trim().max(80).optional(),
        lga: z.string().trim().max(120).optional(),
        city: z.string().trim().max(120).optional(),
      })
      .optional(),
  }),
};

export default advertSchemas;
