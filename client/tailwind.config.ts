import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tg: {
          bg: '#0e1621',
          sidebar: '#17212b',
          chat: '#0e1621',
          input: '#242f3d',
          blue: '#2b5278',
          accent: '#64b5ef',
          hover: '#202b36',
          text: '#f5f5f5',
          muted: '#6c7883',
          green: '#4fae4e',
          bubble: '#182533',
          'bubble-own': '#2b5278',
          border: '#0e1621',
        }
      }
    }
  },
  plugins: [],
};

export default config;
