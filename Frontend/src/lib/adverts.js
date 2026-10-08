/**
 * Shared advert vocabulary. One list of categories so the editor, the browse
 * filters and the admin console can never disagree about what exists.
 */
export const ADVERT_CATEGORIES = [
  { value: 'food', label: 'Food & catering', icon: 'restaurant' },
  { value: 'fashion', label: 'Fashion & tailoring', icon: 'apparel' },
  { value: 'beauty', label: 'Hair & beauty', icon: 'face_retouching_natural' },
  { value: 'phones', label: 'Phones & gadgets', icon: 'smartphone' },
  { value: 'repairs', label: 'Repairs & technicians', icon: 'build' },
  { value: 'home', label: 'Home & furniture', icon: 'chair' },
  { value: 'building', label: 'Building materials', icon: 'construction' },
  { value: 'auto', label: 'Cars & auto parts', icon: 'directions_car' },
  { value: 'events', label: 'Events & photography', icon: 'celebration' },
  { value: 'education', label: 'Lessons & training', icon: 'school' },
  { value: 'health', label: 'Health & pharmacy', icon: 'medication' },
  { value: 'agriculture', label: 'Farm produce', icon: 'agriculture' },
  { value: 'logistics', label: 'Delivery & logistics', icon: 'local_shipping' },
  { value: 'other', label: 'Other services', icon: 'storefront' },
];

export const categoryLabel = (value) =>
  ADVERT_CATEGORIES.find((category) => category.value === value)?.label ?? value;

/** "Ikeja, Lagos" — the most specific two parts the advert has. */
export const placeLine = (advert) =>
  [advert?.city || advert?.lga, advert?.state].filter(Boolean).join(', ');

/** Price is optional and often a range; say only what the advertiser said. */
export const priceLine = (advert, money) => {
  const { price_from: from, price_to: to, price_note: note } = advert ?? {};
  if (from && to && Number(to) > Number(from)) return `${money(from)} – ${money(to)}`;
  if (from) return `From ${money(from)}`;
  return note || null;
};

/** wa.me wants the number in international format with no plus or spaces. */
export const whatsappLink = (phone, text = '') => {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `234${digits.slice(1)}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};

export const telLink = (phone) => (phone ? `tel:${String(phone).replace(/\s/g, '')}` : null);
