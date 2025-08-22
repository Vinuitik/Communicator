/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          300: '#a5b9fc',
          400: '#8b94f8',
          500: '#6c5ce7',  // Your exact purple from navigation
          600: '#5b4cdb',
          700: '#4a3cc9',
          800: '#3930a3',
          900: '#2d2570',
        },
        success: {
          50: '#f0fff4',
          100: '#dcfce7',
          500: '#27ae60',
          600: '#22c55e',
          700: '#16a34a',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#e74c3c',
          600: '#dc2626',
          700: '#b91c1c',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f39c12',
          600: '#d97706',
          700: '#b45309',
        },
        surface: '#ffffff',
        background: '#f8fafc',
        'text-primary': '#1f2937',
        'text-secondary': '#6b7280',
        'border-light': '#e5e7eb',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.12)',
        'form': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'button': '0 1px 2px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
      },
      spacing: {
        'section': '2rem',
        'card': '1.5rem',
      }
    },
  },
  plugins: [],
}