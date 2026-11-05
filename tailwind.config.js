/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        woodland: {
          50: '#f2f9f1',
          100: '#e1f2df',
          200: '#c5e4c2',
          300: '#9bcf96',
          400: '#6bb264',
          500: '#479540',
          600: '#357730',
          700: '#2c5e27',
          800: '#264c23',
          900: '#213f1f',
          950: '#0e220e',
        },
        woodchuck: {
          50: '#fdf8ee',
          100: '#f8eed4',
          200: '#f0daa6',
          300: '#e5bf70',
          400: '#dba13f',
          500: '#ca8522',
          600: '#ae6719',
          700: '#8a4c17',
          800: '#713e19',
          900: '#5e3418',
        }
      }
    },
  },
  plugins: [],
}
