import { useEffect, useRef } from 'react';
import { cn } from '../../lib/cn.js';

/**
 * Six-digit code entry.
 *
 * Details that decide whether this feels good or infuriating:
 *  - inputMode="numeric" so phones open the number pad, not the full keyboard
 *  - autoComplete="one-time-code" so iOS and Android offer the SMS/email code
 *  - paste of the full code fills every box at once
 *  - Backspace on an empty box steps back and clears the previous one
 *  - arrow keys move between boxes
 *  - submits automatically once the sixth digit lands
 */
export const OtpInput = ({ value, onChange, onComplete, length = 6, disabled, hasError }) => {
  const inputs = useRef([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const setDigit = (index, digit) => {
    const next = value.split('');
    next[index] = digit;
    const joined = next.join('').slice(0, length);
    onChange(joined);
    return joined;
  };

  const onInput = (index) => (event) => {
    const digit = event.target.value.replace(/\D/g, '').slice(-1);
    if (!digit) return;

    const joined = setDigit(index, digit);
    if (index < length - 1) inputs.current[index + 1]?.focus();
    if (joined.length === length && !joined.includes(undefined)) onComplete?.(joined);
  };

  const onKeyDown = (index) => (event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (value[index]) {
        setDigit(index, '');
      } else if (index > 0) {
        inputs.current[index - 1]?.focus();
        setDigit(index - 1, '');
      }
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < length - 1) inputs.current[index + 1]?.focus();
  };

  const onPaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    onChange(pasted);
    inputs.current[Math.min(pasted.length, length - 1)]?.focus();
    if (pasted.length === length) onComplete?.(pasted);
  };

  return (
    <div className="flex justify-between gap-2 sm:gap-3" role="group" aria-label={`${length}-digit verification code`}>
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={value[index] ?? ''}
          onChange={onInput(index)}
          onKeyDown={onKeyDown(index)}
          onPaste={onPaste}
          onFocus={(event) => event.target.select()}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          className={cn(
            'h-14 w-full rounded-xl border-2 bg-white text-center font-mono text-2xl font-bold text-purple-700 transition-all',
            'focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:opacity-50',
            hasError
              ? 'border-danger focus:border-danger focus:ring-danger/20'
              : value[index]
                ? 'border-purple-400'
                : 'border-line-strong focus:border-purple-400',
          )}
        />
      ))}
    </div>
  );
};

export default OtpInput;
