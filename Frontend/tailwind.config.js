/**
 * Design tokens.
 *
 * The type system is Archivo (UI + headings) and IBM Plex Mono (codes, figures,
 * references only — never running text). Material Symbols Rounded supplies every
 * icon, so the app no longer ships three icon libraries.
 *
 * Four rules are enforced here rather than left to each screen:
 *
 *   RESTRAINT   Only 400, 500 and 600 exist. 700 is gone. A page that reaches
 *               for bolder weight to create hierarchy is a page whose spacing
 *               and scale are wrong.
 *
 *   FEW COLOURS One brand colour (purple) plus one accent (orange) plus a
 *               neutral grey ramp. The semantic colours are muted on purpose —
 *               they are read at a glance in badges, not stared at.
 *
 *   FIXED SPACE New code uses only 1/2/3/4/6/8 (4, 8, 12, 16, 24, 32px).
 *               Tailwind's other steps stay available so existing screens keep
 *               rendering; they are migrated as each screen is redesigned.
 *
 *   MONO IS DATA Prices, references, OTP codes, counts. Never a sentence.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* Brand. #4A0E67 is the primary; everything else here is a tint or
           shade of it so hover, pressed and surface states stop being invented. */
        brand: {
          50: '#F6F1F9',
          100: '#EADFF0',
          200: '#D3BEE1',
          300: '#B192C9',
          400: '#8757A8',
          500: '#5F1A80',
          600: '#4A0E67',  // primary
          700: '#3A0B50',  // pressed
          800: '#2B0A3C',
          900: '#1C0728',
        },
        /* Accent. Used for one thing per screen — the primary action. */
        accent: {
          50: '#FFF7EC',
          100: '#FFEACC',
          200: '#FCD79B',
          300: '#FABE68',
          400: '#F9A73D',
          500: '#F7941D',
          600: '#DE820F',
          700: '#B2670C',
        },
        /* Legacy aliases — existing screens use purple-* and orange-*.
           Same palette, so nothing shifts; new code should use brand/accent. */
        purple: {
          50: '#F6F1F9', 100: '#EADFF0', 200: '#D3BEE1', 300: '#B192C9', 400: '#8757A8',
          500: '#5F1A80', 600: '#4A0E67', 700: '#3A0B50', 800: '#2B0A3C', 900: '#1C0728',
        },
        orange: {
          50: '#FFF7EC', 100: '#FFEACC', 200: '#FCD79B', 300: '#FABE68', 400: '#F9A73D',
          500: '#F7941D', 600: '#DE820F', 700: '#B2670C', 800: '#8A5200', 900: '#5C3700',
        },
        /* Neutrals. One ramp, named by role so usage is unambiguous. */
        ink: {
          DEFAULT: '#1C1A1F',  // headings
          soft: '#4A464F',     // body
          muted: '#726D79',    // secondary
          faint: '#9B96A3',    // meta, timestamps
        },
        line: { DEFAULT: '#ECEAEF', strong: '#DAD6DE' },
        canvas: { DEFAULT: '#FFFFFF', sunken: '#FAF9FB', raised: '#FFFFFF', warm: '#FFF7EC' },

        success: { DEFAULT: '#11795A', soft: '#E8F4F0' },
        danger: { DEFAULT: '#B5342C', soft: '#FCF0EF' },
        warn: { DEFAULT: '#8A5200', soft: '#FFF7EC' },
        info: { DEFAULT: '#2C5AA0', soft: '#EEF3FB' },
      },

      fontFamily: {
        display: ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        icon: ['"Material Symbols Rounded"'],
      },

      /* Weights: 400 body, 500 emphasis, 600 headings. bold/extrabold are pinned
         to 600 so legacy font-bold classes obey the ceiling instead of breaking. */
      fontWeight: { normal: '400', medium: '500', semibold: '600', bold: '600', extrabold: '600' },

      fontSize: {
        '2xs': ['11px', { lineHeight: '16px', letterSpacing: '0.02em' }],
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '20px' }],
        base: ['15px', { lineHeight: '24px' }],
        lg: ['17px', { lineHeight: '24px', letterSpacing: '-0.005em' }],
        xl: ['20px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        '2xl': ['24px', { lineHeight: '32px', letterSpacing: '-0.015em' }],
        '3xl': ['30px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
        display: ['clamp(32px, 5vw, 52px)', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        title: ['clamp(24px, 3vw, 32px)', { lineHeight: '1.16', letterSpacing: '-0.02em' }],
        heading: ['clamp(18px, 1.8vw, 22px)', { lineHeight: '1.3', letterSpacing: '-0.012em' }],
        eyebrow: ['11px', { lineHeight: '16px', letterSpacing: '0.08em' }],
      },

      borderRadius: { sm: '4px', DEFAULT: '8px', md: '8px', lg: '12px', xl: '16px', '2xl': '20px' },

      /* Elevation reads as light, not as a dark smudge. */
      boxShadow: {
        xs: '0 1px 2px rgba(28,26,31,0.04)',
        card: '0 1px 2px rgba(28,26,31,0.04), 0 1px 6px rgba(28,26,31,0.04)',
        hover: '0 2px 4px rgba(28,26,31,0.04), 0 8px 20px -6px rgba(74,14,103,0.12)',
        lift: '0 4px 8px -2px rgba(28,26,31,0.05), 0 16px 32px -12px rgba(74,14,103,0.16)',
        focus: '0 0 0 3px rgba(74,14,103,0.16)',
      },

      transitionTimingFunction: { out: 'cubic-bezier(0.22, 1, 0.36, 1)' },

      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(8px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up 0.24s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.4s infinite',
        'slide-in': 'slide-in 0.24s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};
