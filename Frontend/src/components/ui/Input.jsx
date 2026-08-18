import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Text field with label, hint, and error wired to the input through
 * aria-describedby / aria-invalid, so screen readers announce the error
 * rather than the user discovering a red border they cannot see.
 */
export const Input = forwardRef(
  (
    { label, hint, error, icon: Icon, suffix, className, containerClassName, type = 'text', required, id, ...props },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    const [reveal, setReveal] = useState(false);

    const isPassword = type === 'password';
    const resolvedType = isPassword && reveal ? 'text' : type;

    return (
      <div className={cn('w-full', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink">
            {label}
            {required && <span className="ml-0.5 text-orange-600" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative">
          {Icon && (
            <Icon
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
              aria-hidden="true"
            />
          )}

          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            required={required}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={cn(error && errorId, hint && !error && hintId) || undefined}
            className={cn(
              'h-11 w-full rounded-xl border bg-white px-3.5 text-[15px] text-ink transition-colors',
              'placeholder:text-ink-faint',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              Icon && 'pl-10',
              (isPassword || suffix) && 'pr-11',
              error
                ? 'border-danger focus:border-danger focus:ring-danger/25'
                : 'border-line-strong focus:border-purple-400 focus:ring-purple-200',
              className,
            )}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setReveal((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint transition hover:text-ink-soft"
              aria-label={reveal ? 'Hide password' : 'Show password'}
            >
              {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          )}

          {!isPassword && suffix && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-muted">{suffix}</span>
          )}
        </div>

        {error ? (
          <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
            <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : (
          hint && <p id={hintId} className="mt-1.5 text-sm text-ink-muted">{hint}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export const Textarea = forwardRef(
  ({ label, hint, error, rows = 4, className, containerClassName, id, required, ...props }, ref) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-sm font-semibold text-ink">
          {label}
          {required && <span className="ml-0.5 text-orange-600" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        className={cn(
          'w-full resize-y rounded-xl border bg-white px-3.5 py-3 text-[15px] leading-relaxed text-ink transition-colors',
          'placeholder:text-ink-faint focus:outline-none focus:ring-2',
          error
            ? 'border-danger focus:border-danger focus:ring-danger/25'
            : 'border-line-strong focus:border-purple-400 focus:ring-purple-200',
          className,
        )}
        {...props}
      />
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-danger">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-sm text-ink-muted">{hint}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export const Select = forwardRef(
  ({ label, hint, error, children, className, containerClassName, id, required, ...props }, ref) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-sm font-semibold text-ink">
          {label}
          {required && <span className="ml-0.5 text-orange-600" aria-hidden="true">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        className={cn(
          'h-11 w-full appearance-none rounded-xl border bg-white bg-[length:16px] bg-[right_0.875rem_center] bg-no-repeat px-3.5 pr-10 text-[15px] text-ink transition-colors focus:outline-none focus:ring-2',
          error
            ? 'border-danger focus:border-danger focus:ring-danger/25'
            : 'border-line-strong focus:border-purple-400 focus:ring-purple-200',
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23857D8F' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-danger">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-sm text-ink-muted">{hint}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';
