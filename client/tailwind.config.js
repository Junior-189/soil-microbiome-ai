/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f0f7f4',
          100: '#d9ede4',
          200: '#b5daca',
          300: '#84c0a8',
          400: '#529e84',
          500: '#2d6a4f',
          600: '#235a41',
          700: '#1b4a34',
          800: '#143b28',
          900: '#0e2c1e',
        },
        earth: {
          brown: '#a0522d',
          cream: '#f5f0e8',
          sand:  '#d4a96a',
          clay:  '#8b4513',
        },
        health: {
          healthy:  '#16a34a',
          at_risk:  '#ca8a04',
          diseased: '#ea580c',
          critical: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
