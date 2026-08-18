import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Info, ArrowLeftRight } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { Input, Textarea, Select } from '../components/ui/Input.jsx';
import { endpoints, ApiError } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { money, CONDITION_LABELS } from '../lib/format.js';
import { cn } from '../lib/cn.js';

const CATEGORIES = [
  'Electronics', 'Phones & Tablets', 'Fashion', 'Home & Furniture', 'Vehicles',
  'Books & Media', 'Sports & Outdoors', 'Tools & Equipment', 'Baby & Kids', 'Services', 'Other',
];

const FEE_PERCENTAGE = 5;
const MIN_FEE = 100;

const ListItem = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    name: '', description: '', category: '', condition: 'good',
    estimatedCost: '', swapFor: '', state: '', city: '', country: 'Nigeria', images: [],
  });
  const [errors, setErrors] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  // Mirrors the server calculation so the figure shown matches what is charged.
  const fee = form.estimatedCost
    ? Math.max(Math.round((Number(form.estimatedCost) * FEE_PERCENTAGE) / 100), MIN_FEE)
    : 0;

  const addImages = async (files) => {
    const remaining = 8 - form.images.length;
    const selected = Array.from(files).slice(0, remaining);
    if (!selected.length) return;

    setIsUploading(true);
    try {
      const uploaded = await Promise.all(selected.map((file) => endpoints.items.uploadImage(file)));
      setForm((current) => ({ ...current, images: [...current.images, ...uploaded.map((entry) => entry.url)] }));
      setErrors((current) => ({ ...current, images: undefined }));
    } catch (error) {
      toast.error(error.message ?? 'Could not upload those photos.');
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      const item = await endpoints.items.create({ ...form, estimatedCost: Number(form.estimatedCost) });
      toast.success('Listing saved. Pay the listing fee to publish it.');
      navigate(`/payment/callback?itemId=${item.id}&action=start`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        const fieldErrors = caught.fieldErrors;
        setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: caught.message });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container-page max-w-3xl py-8 lg:py-12">
      <header className="mb-8">
        <h1 className="text-title font-bold">List an item</h1>
        <p className="mt-2 text-ink-soft">
          Describe what you have and what you want in return. Listings with clear photos get roughly three times more
          offers.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        {errors.form && (
          <div role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
            {errors.form}
          </div>
        )}

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.08em] text-ink-faint">Photos</h2>
          <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4">
            {form.images.map((url, index) => (
              <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-line">
                <img src={url} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
                {index === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-purple-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, images: current.images.filter((entry) => entry !== url) }))}
                  className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-danger opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Remove photo ${index + 1}`}
                >
                  <X size={13} />
                </button>
              </div>
            ))}

            {form.images.length < 8 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
                className={cn(
                  'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed transition',
                  errors.images ? 'border-danger bg-danger-soft' : 'border-line-strong bg-canvas-sunken hover:border-purple-300 hover:bg-purple-50',
                )}
              >
                <Upload size={18} className={cn('text-ink-faint', isUploading && 'animate-pulse')} aria-hidden="true" />
                <span className="text-2xs font-medium text-ink-muted">{isUploading ? 'Uploading…' : 'Add photo'}</span>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => addImages(event.target.files)}
          />
          {errors.images && <p role="alert" className="mt-2 text-sm text-danger">{errors.images}</p>}
          <p className="mt-2 text-xs text-ink-muted">Up to 8 photos. The first one is used as the cover.</p>
        </section>

        <Input
          label="What are you listing?"
          value={form.name}
          onChange={setField('name')}
          error={errors.name}
          placeholder="MacBook Air M1, 2020"
          required
        />

        <Textarea
          label="Describe it honestly"
          value={form.description}
          onChange={setField('description')}
          error={errors.description}
          hint="Mention any scratches, missing parts, or quirks. Honesty prevents wasted trips."
          rows={5}
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Category" value={form.category} onChange={setField('category')} error={errors.category} required>
            <option value="">Choose a category</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </Select>

          <Select label="Condition" value={form.condition} onChange={setField('condition')} error={errors.condition} required>
            {Object.entries(CONDITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>

        <div>
          <Input
            label="What is it worth today?"
            type="number"
            min="1"
            value={form.estimatedCost}
            onChange={setField('estimatedCost')}
            error={errors.estimatedCost}
            suffix="NGN"
            hint="A realistic second-hand value, not what you originally paid."
            required
          />

          {fee > 0 && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-canvas-warm px-4 py-3">
              <Info size={15} className="mt-0.5 shrink-0 text-orange-700" aria-hidden="true" />
              <p className="text-sm text-ink-soft">
                Listing fee: <span className="font-semibold text-ink">{money(fee)}</span>{' '}
                <span className="text-ink-muted">({FEE_PERCENTAGE}% of value, minimum {money(MIN_FEE)})</span>. Charged
                once, when you publish. No commission on the swap itself.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-orange-200 bg-canvas-warm p-5">
          <div className="mb-3 flex items-center gap-2">
            <ArrowLeftRight size={17} className="text-orange-600" />
            <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-orange-800/80">What do you want back?</h2>
          </div>
          <Textarea
            value={form.swapFor}
            onChange={setField('swapFor')}
            error={errors.swapFor}
            placeholder="A DSLR camera, or an iPhone 13 in good condition"
            hint="Be specific. This is what people search for."
            rows={3}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Country" value={form.country} onChange={setField('country')} error={errors.country} />
          <Input label="State" value={form.state} onChange={setField('state')} error={errors.state} placeholder="Kano" />
          <Input label="City" value={form.city} onChange={setField('city')} error={errors.city} placeholder="Kano" />
        </div>

        <Button type="submit" size="lg" fullWidth isLoading={isSubmitting} loadingText="Saving your listing">
          Continue to payment
        </Button>
      </form>
    </div>
  );
};

export default ListItem;
