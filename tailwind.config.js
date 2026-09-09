/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef3c7',
          500: '#facc15',
          600: '#f59e0b',
          700: '#f43f5e',
          800: '#1d4ed8',
          900: '#0f172a'
        },
        midnight: '#050816',
        electric: {
          blue: '#2563eb',
          red: '#ef4444',
          yellow: '#facc15'
        }
      },
      boxShadow: {
        neon: '0 0 30px rgba(59, 130, 246, 0.25)'
      }
    }
  },
  plugins: []
};
