import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Upload, X, Clock, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { endpoints, ApiError } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { dateTime, REJECTION_LABELS } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

const DOCUMENT_TYPES = [
  ['national_id', 'National ID (NIN slip)'],
  ['passport', 'International passport'],
  ['drivers_license', "Driver's licence"],
  ['voters_card', "Voter's card"],
];

/**
 * A single document slot.
 *
 * Uploads immediately on selection and shows a local preview, so the user sees
 * progress per document rather than a single spinner at the end of a four-file
 * form. The server returns a storage path — never a URL — because these files
 * live in a private bucket that only reviewers can reach.
 */
const DocumentSlot = ({ kind, label, hint, required, value, onUploaded, onCleared }) => {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setIsUploading(true);

    // Local preview is instant; the upload happens behind it.
    if (file.type.startsWith('image/')) setPreview(URL.createObjectURL(file));

    try {
      const { path } = await endpoints.verifications.uploadDocument(kind, file);
      onUploaded(path);
    } catch (caught) {
      setPreview(null);
      setError(caught instanceof ApiError ? caught.message : 'Upload failed. Try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-ink">
        {label}
        {required && <span className="ml-0.5 text-orange-600">*</span>}
      </p>

      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-success/30 bg-success-soft">
          {preview ? (
            <img src={preview} alt="" className="h-36 w-full object-cover" />
          ) : (
            <div className="flex h-36 items-center justify-center">
              <FileText size={26} className="text-success" aria-hidden="true" />
            </div>
          )}
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
              <CheckCircle2 size={13} />
              Uploaded
            </span>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                onCleared();
              }}
              className="rounded p-1 text-ink-muted transition hover:text-danger"
              aria-label={`Remove ${label}`}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            'flex h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition',
            error ? 'border-danger bg-danger-soft' : 'border-line-strong bg-canvas-sunken hover:border-purple-300 hover:bg-purple-50',
          )}
        >
          <Upload size={20} className={cn(isUploading && 'animate-pulse', 'text-ink-faint')} aria-hidden="true" />
          <span className="text-xs font-medium text-ink-soft">
            {isUploading ? 'Uploading…' : 'Tap to upload'}
          </span>
          {hint && <span className="px-3 text-center text-2xs text-ink-faint">{hint}</span>}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        className="sr-only"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      {error && <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
};

const STATUS_PANELS = {
  pending: {
    icon: Clock,
    tone: 'bg-orange-50 border-orange-200 text-orange-800',
    title: 'Your documents are in the queue',
    copy: 'Our team reviews every submission by hand. Most decisions are made within 24 hours, and we will email you as soon as yours is ready.',
  },
  under_review: {
    icon: Clock,
    tone: 'bg-purple-50 border-purple-200 text-purple-800',
    title: 'A reviewer is looking at your documents',
    copy: 'This usually takes a few minutes once it has started. No action is needed from you.',
  },
  approved: {
    icon: CheckCircle2,
    tone: 'bg-success-soft border-success/25 text-success',
    title: 'You are verified',
    copy: 'Your profile now carries a verified badge. You can list items and message other swappers.',
  },
};

const Verification = () => {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    documentType: 'national_id',
    documentNumber: '',
    identityDocument: '',
    identityDocumentBack: '',
    addressDocument: '',
    selfieImage: '',
  });

  const load = () =>
    endpoints.verifications
      .status()
      .then(setStatus)
      .finally(() => setIsLoading(false));

  useEffect(() => {
    load();
  }, []);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      await endpoints.verifications.submit(form);
      await refreshUser();
      await load();
      toast.success('Documents submitted. We will email you when a decision is made.');
    } catch (caught) {
      if (caught instanceof ApiError) {
        const fieldErrors = caught.fieldErrors;
        setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: caught.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <PageLoader label="Checking your verification status" />;

  const panel = STATUS_PANELS[status?.status];
  const canSubmit = status?.canSubmit ?? status?.status === 'not_submitted';

  return (
    <div className="container-page max-w-3xl py-8 lg:py-12">
      <header className="mb-8">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1.5 text-2xs font-bold uppercase tracking-[0.12em] text-purple-700">
          <ShieldCheck size={13} />
          Identity verification
        </p>
        <h1 className="text-title font-bold">Verify who you are</h1>
        <p className="mt-2 leading-relaxed text-ink-soft">
          Barter only works when both sides can trust each other. A quick ID check unlocks listing and messaging, and
          puts a verified badge on your profile.
        </p>
      </header>

      {panel && (
        <div className={cn('mb-8 flex gap-3.5 rounded-2xl border p-5', panel.tone)}>
          <panel.icon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{panel.title}</p>
            <p className="mt-1 text-sm leading-relaxed opacity-90">{panel.copy}</p>
            {status.reference && (
              <p className="mt-2 font-mono text-xs opacity-75">Reference: {status.reference}</p>
            )}
            {status.submittedAt && (
              <p className="mt-0.5 text-xs opacity-75">Submitted {dateTime(status.submittedAt)}</p>
            )}
          </div>
        </div>
      )}

      {status?.status === 'approved' && (
        <Button onClick={() => navigate('/list-item')} size="lg">List your first item</Button>
      )}

      {['rejected', 'resubmit'].includes(status?.status) && (
        <div className="mb-8 rounded-2xl border border-orange-200 bg-orange-50 p-5">
          <div className="flex gap-3.5">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-orange-700" aria-hidden="true" />
            <div>
              <p className="font-semibold text-orange-900">We need a clearer submission</p>
              {status.rejectionReason && (
                <p className="mt-1.5 text-sm text-orange-900">
                  <span className="font-semibold">Reason:</span>{' '}
                  {REJECTION_LABELS[status.rejectionReason] ?? status.rejectionReason}
                </p>
              )}
              {status.reviewerNotes && (
                <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm leading-relaxed text-orange-900">
                  {status.reviewerNotes}
                </p>
              )}
              <p className="mt-2.5 text-sm text-orange-800">
                Re-upload below with the document flat, fully in frame, well lit, and all four corners visible.
              </p>
            </div>
          </div>
        </div>
      )}

      {canSubmit && (
        <form onSubmit={onSubmit} className="space-y-6">
          {errors.form && (
            <div role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
              {errors.form}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Which document are you uploading?"
              value={form.documentType}
              onChange={(event) => setField('documentType', event.target.value)}
              error={errors.documentType}
              required
            >
              {DOCUMENT_TYPES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>

            <Input
              label="Document number"
              value={form.documentNumber}
              onChange={(event) => setField('documentNumber', event.target.value)}
              error={errors.documentNumber}
              placeholder="As printed on the document"
              required
            />
          </div>

          <div className="grid gap-4 min-[420px]:grid-cols-2">
            <DocumentSlot
              kind="identity_front"
              label="Front of your ID"
              hint="JPG, PNG or PDF · up to 12MB"
              required
              value={form.identityDocument}
              onUploaded={(path) => setField('identityDocument', path)}
              onCleared={() => setField('identityDocument', '')}
            />
            <DocumentSlot
              kind="identity_back"
              label="Back of your ID"
              hint="If your document has one"
              value={form.identityDocumentBack}
              onUploaded={(path) => setField('identityDocumentBack', path)}
              onCleared={() => setField('identityDocumentBack', '')}
            />
            <DocumentSlot
              kind="selfie"
              label="Selfie holding your ID"
              hint="Your face and the ID both clearly visible"
              required
              value={form.selfieImage}
              onUploaded={(path) => setField('selfieImage', path)}
              onCleared={() => setField('selfieImage', '')}
            />
            <DocumentSlot
              kind="address"
              label="Proof of address"
              hint="Optional · utility bill or bank statement"
              value={form.addressDocument}
              onUploaded={(path) => setField('addressDocument', path)}
              onCleared={() => setField('addressDocument', '')}
            />
          </div>

          {(errors.identityDocument || errors.selfieImage) && (
            <p role="alert" className="text-sm text-danger">
              {errors.identityDocument ?? errors.selfieImage}
            </p>
          )}

          <div className="rounded-xl bg-canvas-sunken px-4 py-3.5 text-xs leading-relaxed text-ink-muted">
            Your documents are stored privately and are only ever visible to our verification team during review. They
            are never shown on your profile, shared with other members, or used for anything else.
          </div>

          <Button
            type="submit"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            loadingText="Submitting"
            disabled={!form.identityDocument || !form.selfieImage || !form.documentNumber}
          >
            Submit for review
          </Button>
        </form>
      )}

      {!canSubmit && status?.status !== 'approved' && (
        <Button as={Link} to="/dashboard" variant="outline">Back to dashboard</Button>
      )}
    </div>
  );
};

export default Verification;
