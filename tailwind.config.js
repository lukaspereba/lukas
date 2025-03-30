/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'gradient': 'gradient 15s ease infinite',
      },
      scale: {
        '102': '1.02',
      },
      keyframes: {
        gradient: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          },
        },
      },
      colors: {
        'theme-light': {
          bg: '#ffffff',
          text: '#1a1a1a',
        },
        'theme-dark': {
          bg: '#1a1a1a',
          text: '#ffffff',
        },
      },
    },
  },
  plugins: [],
};