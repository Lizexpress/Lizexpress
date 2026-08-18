import clsx from 'clsx';

/**
 * Class name helper. Thin wrapper so components import from one place and we
 * can swap in tailwind-merge later without touching every file.
 */
export const cn = (...inputs) => clsx(inputs);
export default cn;
