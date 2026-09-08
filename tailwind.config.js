/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#1C2530',
          soft: '#3A4552',
          faint: '#6B7684',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#F5F6F7',
          base: '#EEF0F2',
        },
        steel: {
          50: '#EEF4FB',
          100: '#D6E5F5',
          400: '#4A85BE',
          500: '#2B6CB0',
          600: '#22558D',
          700: '#1B4370',
        },
        amber: {
          50: '#FEF6E7',
          400: '#E29332',
          500: '#D97706',
          600: '#B35F04',
        },
        moss: {
          50: '#EAF5EE',
          500: '#1E7A44',
          600: '#15602F',
        },
        brick: {
          50: '#FBEBEA',
          500: '#B23B34',
          600: '#8F2C27',
        },
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
      },
    },
  },
  plugins: [],
}
