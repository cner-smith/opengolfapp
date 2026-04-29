/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        fairway: {
          50: '#f1f8f3',
          100: '#dcecdf',
          500: '#3f8d5a',
          700: '#23613b',
          900: '#143923',
        },
      },
    },
  },
  plugins: [],
}
