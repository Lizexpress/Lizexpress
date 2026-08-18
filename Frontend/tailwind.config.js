/**
 * Brand tokens are locked to the v1 palette. The hex values below were counted
 * out of the v1 source — #4A0E67 appeared 299 times, #F7941D 122 times. Nothing
 * here is a new colour; the scales are tints and shades derived from those two
 * so that hover, disabled, and surface states stop being invented ad hoc.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        purple: {
          50: '#F4EEF7',
          100: '#E6DAEE',
          200: '#CDB5DD',
          300: '#A97FC2',
          400: '#7E45A0',
          500: '#5A1077',
          600: '#4A0E67',   // ← brand primary
          700: '#3A0B50',   // ← brand primary, pressed
          800: '#2D0A3D',
          900: '#1F0729',
        },
        orange: {
          50: '#FFF5E6',    // ← brand cream surface
          100: '#FFE9C7',
          200: '#FCD79B',
          300: '#FABE68',
          400: '#F9A73D',
          500: '#F7941D',   // ← brand accent
          600: '#E68A1C',   // ← brand accent, pressed
          700: '#C06F12',
          800: '#8A5200',
          900: '#5C3700',
        },
        ink: {
          DEFAULT: '#241C2C',  // headings — softened from near-black #1A1420
          soft:    '#524A5C',  // body copy
          muted:   '#7C7488',  // secondary
          faint:   '#A9A2B3',  // meta, timestamps
        },
        line: { DEFAULT: '#EDE9F0', strong: '#DCD5E1' },
        canvas: { DEFAULT: '#FFFFFF', sunken: '#FAF8FB', warm: '#FFF5E6' },
        success: { DEFAULT: '#12805C', soft: '#E6F4EF' },
        danger: { DEFAULT: '#C0342B', soft: '#FDF0EF' },
        warn: { DEFAULT: '#8A5200', soft: '#FFF5E6' },
      },
      fontFamily: {
        display: ['"Clash Display"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
        sans: ['Satoshi', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Tightened tracking on the large sizes — Clash Display is airy by default.
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
        display: ['clamp(2.25rem, 5.5vw, 3.75rem)', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        title:   ['clamp(1.6rem, 3vw, 2.25rem)',    { lineHeight: '1.12', letterSpacing: '-0.022em' }],
        heading: ['clamp(1.2rem, 1.8vw, 1.5rem)',   { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        eyebrow: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.11em' }],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem', '3xl': '1.5rem' },
      boxShadow: {
        // Layered and low-opacity: reads as elevation rather than a dark smudge.
        card:  '0 1px 2px rgba(36,28,44,0.05), 0 2px 8px -2px rgba(36,28,44,0.06)',
        hover: '0 2px 4px rgba(36,28,44,0.05), 0 12px 24px -8px rgba(74,14,103,0.14)',
        lift:  '0 4px 8px -2px rgba(36,28,44,0.06), 0 20px 40px -12px rgba(74,14,103,0.18)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.6)',
        focus: '0 0 0 3px rgba(247,148,29,0.35)',
      },
      transitionTimingFunction: { swap: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(12px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'swap-rotate': { '0%,100%': { transform: 'rotate(0deg)' }, '50%': { transform: 'rotate(180deg)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'slide-in': 'slide-in 0.3s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
