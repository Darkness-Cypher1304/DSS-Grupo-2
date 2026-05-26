import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ====================================================================
        // PALETA NEUROALERT
        // Inspirada en clinical confidence + warmth
        //   - Teal profundo: confianza, salud, calma
        //   - Coral suave: cercanía, calidez humana
        //   - Bone: fondos suaves, no blanco frío
        // ====================================================================
        bone: {
          50: '#fdfcf9',
          100: '#f7f4ed',
          200: '#ede8db',
          300: '#ddd5c0',
          400: '#c4b899',
        },
        teal: {
          50: '#f0f7f6',
          100: '#dceeec',
          200: '#bcdedb',
          300: '#8cc4bf',
          400: '#5aa5a0',
          500: '#3d8581',
          600: '#2c6966',
          700: '#235452',
          800: '#1a4341',
          900: '#0f2e2c',
          950: '#071917',
        },
        coral: {
          50: '#fef4f1',
          100: '#fde6df',
          200: '#fbcdc0',
          300: '#f6a591',
          400: '#ee7a60',
          500: '#e35a3e',
          600: '#cf3f23',
          700: '#a8311c',
          800: '#852b1e',
          900: '#6b271e',
        },
        ink: {
          DEFAULT: '#1a1d1c',
          soft: '#2d3230',
          mute: '#5a615e',
          fade: '#8a918e',
        },
      },
      fontFamily: {
        // Display: serif elegante con personalidad — Fraunces
        display: ['Fraunces', 'Georgia', 'serif'],
        // Body: sans-serif moderno y técnico — Geist
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        // Mono para código y números clínicos
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.04 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};

export default config;
