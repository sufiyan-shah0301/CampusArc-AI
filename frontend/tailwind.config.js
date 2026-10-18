import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Manrope', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: { 50: '#effcf9', 100: '#c8f6ec', 200: '#93ecd9', 300: '#55dac1', 400: '#27c1a7', 500: '#0fa58f', 600: '#0b8574', 700: '#0d6a5e', 800: '#0f554d', 900: '#10463f' },
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        blob: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '33%': { transform: 'translate(30px,-40px) scale(1.1)' }, '66%': { transform: 'translate(-24px,20px) scale(0.95)' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        rise: { from: { opacity: '0', transform: 'translateY(22px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: { float: 'float 6s ease-in-out infinite', blob: 'blob 18s ease-in-out infinite', marquee: 'marquee 30s linear infinite', rise: 'rise 0.7s cubic-bezier(0.21,0.47,0.32,0.98) both' },
    },
  },
  plugins: [typography],
};
