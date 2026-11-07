/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Oswald"', 'ui-sans-serif', 'sans-serif'],
        sport: ['"Outfit"', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        // Primary Blue Note Woodchuckers Teal (#1A607C)
        woodland: {
          50: '#edf7fa',
          100: '#d4ebf2',
          200: '#aedce8',
          300: '#7bc3d7',
          400: '#3ea4c1',
          500: '#1a607c', // Exact primary brand color from original logo
          600: '#155169',
          700: '#134358',
          800: '#113748',
          900: '#0e2e3d',
          950: '#071d27',
        },
        bluenote: {
          50: '#edf7fa',
          100: '#d4ebf2',
          200: '#aedce8',
          300: '#7bc3d7',
          400: '#3ea4c1',
          500: '#1a607c',
          600: '#155169',
          700: '#134358',
          800: '#113748',
          900: '#0e2e3d',
          950: '#071d27',
        },
        // Craft Beer Gold / Amber Woodchuck fur & pint (#DE9C1E)
        woodchuck: {
          50: '#fdfaf0',
          100: '#faf0d3',
          200: '#f5dfa3',
          300: '#eec86c',
          400: '#e5a837',
          500: '#de9c1e', // Fresh beer pint & woodchuck cheeks
          600: '#bc6c11',
          700: '#974e11',
          800: '#7c3d14',
          900: '#683415',
          950: '#3d1b06',
        },
        // Alabaster cream & bottle cap ink dark neutrals
        brand: {
          cream: '#faf2ee', // Woodchuck snout and banner ribbon off-white
          ink: '#0d1113',   // Crisp bottle cap graphic black
          teal: '#1a607c',  // Heritage Blue Note Teal
          gold: '#de9c1e',  // Brew gold
        },
        // Backward-compatibility: map emerald classes to the new brand teal
        emerald: {
          50: '#edf7fa',
          100: '#d4ebf2',
          200: '#aedce8',
          300: '#7bc3d7',
          400: '#3ea4c1',
          500: '#1a607c',
          600: '#155169',
          700: '#134358',
          800: '#113748',
          900: '#0e2e3d',
          950: '#071d27',
        }
      }
    },
  },
  plugins: [],
}
