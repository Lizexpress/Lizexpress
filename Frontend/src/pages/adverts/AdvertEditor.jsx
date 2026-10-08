import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SmartLink as Link } from '../../components/ui/SmartLink.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Image from '../../components/ui/Image.jsx';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { LocationFields } from '../../components/adverts/LocationFields.jsx';
import { endpoints, ApiError } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { money } from '../../lib/format.js';
import { ADVERT_CATEGORIES } from '../../lib/adverts.js';
import { cn } from '../../lib/cn.js';

const STEPS = [
  { key: 'details', label: 'Details' },
  { key: 'photos', label: 'Photos' },
  { key: 'publish', label: 'Pay and publish' },
];

const MAX_PHOTOS = 12;
const PHOTO_PRICE = 1000; // display fallback only — the server quote is authoritative

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Shrinks a camera photo before it leaves the phone.
 *
 * A modern phone photo is 3–8MB. On Nigerian mobile data that is the
 * difference between an upload that finishes and one that times out — and the
 * site never displays anything wider than 1600px anyway. Re-encoding as JPEG
 * at 0.82 typically lands around 250–400KB with no visible loss.
 *
 * Falls back to the original file whenever the browser cannot decode it (HEIC
 * on Android, for instance), so resizing can only ever help.
 */
const shrinkImage = async (file, maxSide = 1600, quality = 0.82) => {
  if (!file.type.startsWith('image/') || file.type === 'image/heic' || file.size < 400_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
};

/** Drops empty strings so optional fields are omitted rather than sent as "". */
const clean = (values) =>
  Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
      .filter(([, value]) => value !== '' && value !== null && value !== undefined),
  );

const phoneDigits = (value) => (value ? value.replace(/[\s-]/g, '') : value);

/* ────────────────────────────────────────────────────────────────────────── */

const AdvertEditor = () => {
  const { id } = useParams();
  const isNew = !id;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [advert, setAdvert] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const step = isNew ? 'details' : params.get('step') ?? 'details';
  const goToStep = (key) => setParams(key === 'details' ? {} : { step: key }, { replace: true });

  const reload = useCallback(async () => {
    if (isNew) return null;
    const data = await endpoints.adverts.detail(id);
    setAdvert(data);
    return data;
  }, [id, isNew]);

  useEffect(() => {
    if (isNew) return;
    reload()
      .catch(() => {
        toast.error('That advert could not be found.');
        navigate('/dashboard/adverts', { replace: true });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <PageLoader label="Loading advert" />;

  const stepIndex = STEPS.findIndex((entry) => entry.key === step);
  const photoCount = advert?.photos?.length ?? 0;

  return (
    <div className="container-page max-w-3xl py-8 lg:py-12">
      <Link to="/dashboard/adverts" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <Icon name="arrow_back" size="sm" />
        My adverts
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl">{isNew ? 'Create an advert' : advert?.title}</h1>
          <p className="mt-1 text-ink-muted">
            {isNew
              ? 'Tell customers what you offer and where to find you.'
              : `${advert?.business_name} in ${advert?.lga}, ${advert?.state}`}
          </p>
        </div>
        {advert && <StatusBadge status={advert.status} />}
      </header>

      {/* The steps are a real sequence, so they are numbered. */}
      <ol className="mt-8 grid grid-cols-3 gap-2" aria-label="Progress">
        {STEPS.map((entry, index) => {
          const reachable = !isNew && (index < 2 || photoCount > 0);
          const current = index === stepIndex;
          const done = index < stepIndex;
          return (
            <li key={entry.key}>
              <button
                type="button"
                disabled={!reachable || current}
                onClick={() => goToStep(entry.key)}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'w-full border-t-2 pt-2 text-left text-sm transition-colors',
                  current ? 'border-brand-600 text-ink' : done ? 'border-brand-300 text-ink-soft' : 'border-line text-ink-faint',
                  reachable && !current && 'hover:text-ink',
                )}
              >
                <span className="mono mr-1">{index + 1}</span>
                <span className={cn(current && 'font-medium')}>{entry.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-8">
        {step === 'details' && (
          <DetailsStep
            advert={advert}
            user={user}
            onSaved={(saved) => {
              if (isNew) {
                navigate(`/dashboard/adverts/${saved.id}?step=photos`, { replace: true });
              } else {
                setAdvert(saved);
                toast.success('Advert details saved.');
                goToStep('photos');
              }
            }}
          />
        )}
        {step === 'photos' && advert && (
          <PhotosStep advert={advert} reload={reload} onNext={() => goToStep('publish')} />
        )}
        {step === 'publish' && advert && <PublishStep advert={advert} onBack={() => goToStep('photos')} />}
      </div>

      {!isNew && advert && <DangerZone advert={advert} />}
    </div>
  );
};

/* ───────────────────────── Step 1: details ───────────────────────── */

const DetailsStep = ({ advert, user, onSaved }) => {
  const [form, setForm] = useState(() => ({
    businessName: advert?.business_name ?? user?.business_name ?? '',
    title: advert?.title ?? '',
    category: advert?.category ?? '',
    description: advert?.description ?? '',
    priceFrom: advert?.price_from ?? '',
    priceTo: advert?.price_to ?? '',
    priceNote: advert?.price_note ?? '',
    contactPhone: advert?.contact_phone ?? user?.business_phone ?? user?.phone ?? '',
    contactWhatsapp: advert?.contact_whatsapp ?? '',
    contactEmail: advert?.contact_email ?? '',
    websiteUrl: advert?.website_url ?? '',
    address: advert?.address ?? '',
  }));
  const [location, setLocation] = useState(() => ({
    stateCode: advert?.state_code ?? '',
    state: advert?.state ?? user?.state ?? '',
    lga: advert?.lga ?? user?.business_lga ?? '',
    city: advert?.city ?? user?.city ?? '',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const field = (key) => ({
    value: form[key],
    onChange: (event) => setForm((current) => ({ ...current, [key]: event.target.value })),
    'aria-invalid': errors[key] ? 'true' : undefined,
  });

  const submit = async (event) => {
    event.preventDefault();
    setErrors({});

    const local = {};
    if (!location.stateCode) local.state = 'Choose a state.';
    if (!location.lga?.trim()) local.lga = 'Enter the local government area you serve.';
    if (Object.keys(local).length) return setErrors(local);

    const payload = clean({
      ...form,
      contactPhone: phoneDigits(form.contactPhone),
      contactWhatsapp: phoneDigits(form.contactWhatsapp),
      priceFrom: form.priceFrom === '' ? undefined : Number(form.priceFrom),
      priceTo: form.priceTo === '' ? undefined : Number(form.priceTo),
      ...location,
    });

    setSaving(true);
    try {
      const saved = advert
        ? await endpoints.adverts.update(advert.id, payload)
        : await endpoints.adverts.create(payload);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setErrors(error.fieldErrors);
        document.querySelector('[aria-invalid="true"]')?.focus();
      } else {
        setErrors({ form: error.message });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-8">
      <fieldset className="grid gap-4">
        <legend className="mb-2 text-lg font-semibold text-ink">What you offer</legend>

        <Field label="Business name" error={errors.businessName}>
          <input className="field" placeholder="e.g. Mama Tolu Kitchen" maxLength={140} {...field('businessName')} />
        </Field>

        <Field label="Headline" hint="What a customer should know at a glance." error={errors.title}>
          <input className="field" placeholder="e.g. Small chops and party jollof for events" maxLength={140} {...field('title')} />
        </Field>

        <Field label="Category" error={errors.category}>
          <select className="field" {...field('category')}>
            <option value="">Choose a category</option>
            {ADVERT_CATEGORIES.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </select>
        </Field>

        <Field
          label="Description"
          hint={`${form.description.length}/4000 · What you sell, how ordering works, delivery, opening hours.`}
          error={errors.description}
        >
          <textarea className="field min-h-[160px] py-3 leading-relaxed" maxLength={4000} {...field('description')} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-lg font-semibold text-ink">
          Price <span className="text-base font-normal text-ink-faint">(optional)</span>
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From (₦)" error={errors.priceFrom}>
            <input className="field mono" type="number" inputMode="numeric" min="0" placeholder="5000" {...field('priceFrom')} />
          </Field>
          <Field label="Up to (₦)" error={errors.priceTo}>
            <input className="field mono" type="number" inputMode="numeric" min="0" placeholder="50000" {...field('priceTo')} />
          </Field>
        </div>
        <Field label="Or describe your pricing" hint="e.g. Price depends on quantity. Call for a quote." error={errors.priceNote}>
          <input className="field" maxLength={140} {...field('priceNote')} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-lg font-semibold text-ink">How customers reach you</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone number" error={errors.contactPhone}>
            <input className="field mono" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" {...field('contactPhone')} />
          </Field>
          <Field label="WhatsApp" hint="Leave empty if it is the same number." error={errors.contactWhatsapp}>
            <input className="field mono" type="tel" inputMode="tel" placeholder="0803 123 4567" {...field('contactWhatsapp')} />
          </Field>
          <Field label="Email (optional)" error={errors.contactEmail}>
            <input className="field" type="email" autoComplete="email" {...field('contactEmail')} />
          </Field>
          <Field label="Website or Instagram (optional)" error={errors.websiteUrl}>
            <input className="field" type="url" placeholder="https://" {...field('websiteUrl')} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-lg font-semibold text-ink">Where you are</legend>
        <p className="-mt-2 text-sm text-ink-muted">Customers search by state and local government, so choose the area you actually serve.</p>
        <LocationFields value={location} onChange={setLocation} errors={errors} />
        <Field label="Shop address (optional)" error={errors.address}>
          <input className="field" maxLength={300} placeholder="e.g. 12 Opebi Road, beside GTBank" {...field('address')} />
        </Field>
      </fieldset>

      {errors.form && (
        <p role="alert" className="error rounded-lg bg-danger-soft p-3">
          <Icon name="error" size="sm" />
          {errors.form}
        </p>
      )}

      <div className="flex justify-end border-t border-line pt-6">
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
          {saving ? 'Saving…' : advert ? 'Save and continue' : 'Continue to photos'}
        </button>
      </div>
    </form>
  );
};

/* ───────────────────────── Step 2: photos ───────────────────────── */

const PhotosStep = ({ advert, reload, onNext }) => {
  const toast = useToast();
  const inputRef = useRef(null);
  const [uploads, setUploads] = useState([]); // { key, name, preview, state: 'working'|'failed', message }
  const [dragging, setDragging] = useState(false);

  const photos = [...(advert.photos ?? [])].sort((a, b) => a.position - b.position);
  const unpaid = photos.filter((photo) => !photo.is_paid).length;
  const remaining = MAX_PHOTOS - photos.length - uploads.filter((u) => u.state === 'working').length;
  const isLive = advert.status === 'active';

  const handleFiles = async (fileList) => {
    const files = [...fileList].filter((file) => file.type.startsWith('image/')).slice(0, Math.max(remaining, 0));
    if (!files.length) return;

    const batch = files.map((file) => ({
      key: `${file.name}-${file.size}-${Math.random()}`,
      file,
      name: file.name,
      preview: URL.createObjectURL(file),
      state: 'working',
    }));
    setUploads((current) => [...current, ...batch]);

    // One at a time: on a weak connection, parallel uploads all slow down and
    // all time out together. Sequential means each finished photo is saved.
    for (const entry of batch) {
      try {
        const small = await shrinkImage(entry.file);
        await endpoints.adverts.addPhoto(advert.id, small);
        URL.revokeObjectURL(entry.preview);
        setUploads((current) => current.filter((u) => u.key !== entry.key));
        await reload();
      } catch (error) {
        setUploads((current) =>
          current.map((u) => (u.key === entry.key ? { ...u, state: 'failed', message: error.message } : u)),
        );
      }
    }
  };

  const removePhoto = async (photo) => {
    try {
      await endpoints.adverts.removePhoto(photo.id);
      await reload();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg">Photos of your products or work</h2>
        <p className="text-sm text-ink-muted">
          <span className="mono text-ink">{photos.length}</span> of <span className="mono">{MAX_PHOTOS}</span>
        </p>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Each photo costs <span className="mono text-ink">{money(PHOTO_PRICE)}</span>, charged once. Clear, well-lit photos get more calls.
      </p>

      {isLive && (
        <p className="mt-4 rounded-lg bg-info-soft p-3 text-sm text-info">
          This advert is live. Photos on a live advert are locked; create a new advert to show more products.
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo, index) => (
          <figure key={photo.id} className="relative">
            <Image src={photo.url} alt={`Photo ${index + 1}`} width={400} ratio="media-square" />
            <figcaption className="absolute inset-x-2 top-2 flex items-start justify-between">
              {index === 0 ? <span className="badge bg-canvas/90 text-ink">Cover</span> : <span />}
              {photo.is_paid ? (
                <span className="badge bg-canvas/90 text-success"><Icon name="check" size="sm" />Paid</span>
              ) : (
                <button
                  type="button"
                  onClick={() => removePhoto(photo)}
                  aria-label={`Remove photo ${index + 1}`}
                  className="grid h-8 w-8 place-items-center rounded-full bg-canvas/90 text-ink-soft transition-colors hover:bg-danger hover:text-white"
                >
                  <Icon name="close" size="sm" />
                </button>
              )}
            </figcaption>
          </figure>
        ))}

        {uploads.map((entry) => (
          <figure key={entry.key} className="relative">
            <div className="media media-square">
              <img src={entry.preview} alt="" className={cn(entry.state === 'working' && 'opacity-50')} />
            </div>
            <figcaption className="absolute inset-0 grid place-items-center p-2 text-center">
              {entry.state === 'working' ? (
                <span className="badge bg-canvas/90 text-ink">Uploading…</span>
              ) : (
                <span className="flex flex-col items-center gap-2">
                  <span className="badge bg-danger text-white">Failed</span>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setUploads((current) => current.filter((u) => u.key !== entry.key));
                      handleFiles([entry.file]);
                    }}
                  >
                    Retry
                  </button>
                </span>
              )}
            </figcaption>
          </figure>
        ))}

        {!isLive && remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              handleFiles(event.dataTransfer.files);
            }}
            className={cn(
              'media media-square flex flex-col items-center justify-center gap-2 border-2 border-dashed text-ink-muted transition-colors',
              dragging ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line-strong hover:border-ink-faint hover:text-ink',
            )}
          >
            <Icon name="add_photo_alternate" size="lg" />
            <span className="text-sm font-medium">Add photos</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        hidden
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <div className="sticky bottom-0 -mx-4 mt-8 flex items-center justify-between gap-4 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur pb-safe sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:backdrop-blur-none">
        <p className="text-sm text-ink-soft">
          {unpaid > 0 ? (
            <>
              <span className="mono">{unpaid}</span> × <span className="mono">{money(PHOTO_PRICE)}</span> ={' '}
              <span className="mono font-medium text-ink">{money(unpaid * PHOTO_PRICE)}</span>
            </>
          ) : photos.length ? (
            'All photos paid'
          ) : (
            'Add at least one photo'
          )}
        </p>
        <button
          type="button"
          className="btn-primary"
          disabled={!photos.length || uploads.some((u) => u.state === 'working')}
          onClick={onNext}
        >
          Review and pay
        </button>
      </div>
    </div>
  );
};

/* ───────────────────────── Step 3: publish ───────────────────────── */

const PublishStep = ({ advert, onBack }) => {
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    endpoints.adverts.quote(advert.id).then(setQuote).catch((err) => setError(err.message));
  }, [advert.id]);

  const pay = async () => {
    setError('');
    if (typeof window.FlutterwaveCheckout !== 'function') {
      setError('The payment window could not load. Check your connection and refresh the page.');
      return;
    }
    setPaying(true);
    try {
      const init = await endpoints.adverts.checkout(advert.id);
      window.FlutterwaveCheckout({
        public_key: init.publicKey,
        tx_ref: init.txRef,
        amount: init.amount,
        currency: init.currency,
        payment_options: 'card,banktransfer,ussd',
        redirect_url: `${window.location.origin}/payment/callback`,
        customer: init.customer,
        customizations: init.customizations,
        meta: init.meta,
        onclose: () => setPaying(false),
      });
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  };

  if (!quote && !error) return <PageLoader label="Calculating price" />;

  const cover = [...(advert.photos ?? [])].sort((a, b) => a.position - b.position)[0];
  const nothingToPay = quote && quote.billablePhotos === 0;

  return (
    <div className="grid gap-8 md:grid-cols-[220px_1fr]">
      <div>
        <Image src={cover?.url} alt="" width={440} />
        <p className="mt-3 text-sm text-ink-muted">{advert.business_name}</p>
        <p className="font-medium leading-snug text-ink">{advert.title}</p>
        <Link to={`/adverts/${advert.id}`} className="mt-2 inline-block text-sm text-brand-600 hover:underline">
          Preview advert
        </Link>
      </div>

      <div>
        <h2 className="text-lg">Summary</h2>
        {quote && (
          <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
            <Row label="Photos on this advert" value={quote.photoCount} />
            <Row label="Photos to pay for" value={quote.billablePhotos} />
            <Row label="Price per photo" value={money(quote.unitPrice)} />
            <Row label="Runs for" value={`${quote.durationDays} days`} />
            <div className="flex items-baseline justify-between py-4">
              <dt className="font-medium text-ink">Total</dt>
              <dd className="mono text-2xl font-medium text-ink">{money(quote.total)}</dd>
            </div>
          </dl>
        )}

        {error && (
          <p role="alert" className="error mt-4 rounded-lg bg-danger-soft p-3">
            <Icon name="error" size="sm" />
            {error}
          </p>
        )}

        {nothingToPay ? (
          <p className="mt-6 rounded-lg bg-success-soft p-4 text-sm text-success">
            Every photo on this advert is paid for.
            {advert.status === 'active' ? ' Your advert is live.' : ' It will go live as soon as the last payment is confirmed.'}
          </p>
        ) : (
          <div className="mt-6 grid gap-3 sm:flex sm:justify-between">
            <button type="button" className="btn-ghost" onClick={onBack}>Back to photos</button>
            <button type="button" className="btn-accent" onClick={pay} disabled={paying || !quote}>
              <Icon name="lock" size="sm" />
              {paying ? 'Opening payment…' : `Pay ${money(quote?.total ?? 0)} and publish`}
            </button>
          </div>
        )}

        <p className="mt-6 text-sm text-ink-muted">
          Payment is handled by Flutterwave. You can pay by card, bank transfer or USSD. Your advert goes live as soon as payment is confirmed.
        </p>
      </div>
    </div>
  );
};

const Row = ({ label, value }) => (
  <div className="flex items-baseline justify-between py-3">
    <dt className="text-ink-muted">{label}</dt>
    <dd className="mono text-ink">{value}</dd>
  </div>
);

/* ───────────────────────── Remove ───────────────────────── */

const DangerZone = ({ advert }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const paid = Number(advert.amount_paid_kobo ?? 0) > 0;

  const remove = async () => {
    try {
      await endpoints.adverts.remove(advert.id);
      toast.success(paid ? 'Advert archived.' : 'Advert deleted.');
      navigate('/dashboard/adverts', { replace: true });
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <section className="mt-16 border-t border-line pt-6">
      {!confirming ? (
        <button type="button" className="btn-ghost btn-sm text-danger" onClick={() => setConfirming(true)}>
          <Icon name="delete" size="sm" />
          {paid ? 'Archive this advert' : 'Delete this advert'}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-soft p-4">
          <p className="flex-1 text-sm text-ink">
            {paid
              ? 'Archiving takes the advert offline. Payments are not refunded.'
              : 'This deletes the advert and its photos.'}
          </p>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirming(false)}>Keep it</button>
          <button type="button" className="btn btn-sm bg-danger text-white" onClick={remove}>
            {paid ? 'Archive' : 'Delete'}
          </button>
        </div>
      )}
    </section>
  );
};

const Field = ({ label, hint, error, children }) => (
  <div>
    {/* Label text in its own span: inputs inherit font weight from a wrapping
        <label>, so styling the label itself would make typed text medium. */}
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
    {error ? (
      <p className="error" role="alert"><Icon name="error" size="sm" />{error}</p>
    ) : (
      hint && <p className="hint">{hint}</p>
    )}
  </div>
);

export default AdvertEditor;
