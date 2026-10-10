/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f4f7fb',
          100: '#e6ecf5',
          200: '#c7d5e8',
          300: '#9ab4d3',
          400: '#688db8',
          500: '#456c9c',
          600: '#35547f',
          700: '#2c4466',
          800: '#1d2f47',
          900: '#0f1b2d',
          950: '#0a1220',
        },
        accent: {
          50: '#effdfa',
          100: '#c7f7ef',
          200: '#92ecdf',
          300: '#57dbcb',
          400: '#2cc2b3',
          500: '#14a89c',
          600: '#0d867f',
          700: '#0f6b67',
          800: '#115654',
          900: '#124847',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        raised: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
      },
    },
  },
  plugins: [],
};
