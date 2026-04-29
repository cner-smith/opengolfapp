/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
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
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        xs: ['11px', { lineHeight: '1.4' }],
        sm: ['13px', { lineHeight: '1.5' }],
        base: ['15px', { lineHeight: '1.6' }],
        lg: ['18px', { lineHeight: '1.4' }],
        xl: ['22px', { lineHeight: '1.3' }],
        '2xl': ['28px', { lineHeight: '1.2' }],
        '3xl': ['36px', { lineHeight: '1.1' }],
      },
      borderRadius: {
        DEFAULT: '7px',
        card: '10px',
        sheet: '16px',
      },
    },
  },
  plugins: [],
}
