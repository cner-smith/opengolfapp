/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        oga: {
          black: '#111111',
          green: '#1D9E75',
          'green-light': '#E1F5EE',
          'green-mid': '#9FE1CB',
          'green-dark': '#0F6E56',
          red: '#E24B4A',
          'red-light': '#FCEBEB',
          'red-dark': '#A32D2D',
          amber: '#EF9F27',
          'amber-light': '#FAEEDA',
          'amber-dark': '#854F0B',
          'bg-page': '#F4F4F0',
          'bg-card': '#FFFFFF',
          'bg-input': '#F9F9F6',
          border: '#E4E4E0',
          'border-dark': '#D0D0CA',
          'text-primary': '#111111',
          'text-muted': '#888880',
          'text-hint': '#AAAAAA',
        },
      },
    },
  },
  plugins: [],
}
