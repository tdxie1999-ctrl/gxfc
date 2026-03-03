import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/styles/**/*.css',
  ],
  theme: {
    extend: {
      colors: {
        felt: '#1a6b3c',
        wood: '#8B6914',
        gold: '#D4A017',
        sky: '#87CEEB',
        lake: '#0d4a2a',
        lotteryBlue: '#4A90D9',
        luckyRed: '#E74C3C',
      },
      fontFamily: {
        display: ['"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'sans-serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"Roboto Mono"', '"SFMono-Regular"', 'Menlo', 'monospace'],
      },
      keyframes: {
        floatCloud: {
          '0%': { transform: 'translateX(-10%)' },
          '50%': { transform: 'translateX(10%)' },
          '100%': { transform: 'translateX(-10%)' },
        },
        shimmerWater: {
          '0%': { transform: 'translateX(-5%)', opacity: '0.25' },
          '50%': { transform: 'translateX(5%)', opacity: '0.45' },
          '100%': { transform: 'translateX(-5%)', opacity: '0.25' },
        },
        pulseDot: {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.45' },
          '40%': { transform: 'translateY(-8px)', opacity: '1' },
        },
        rotatePhone: {
          '0%': { transform: 'rotate(0deg)' },
          '30%': { transform: 'rotate(18deg)' },
          '60%': { transform: 'rotate(90deg)' },
          '100%': { transform: 'rotate(90deg)' },
        },
      },
      animation: {
        floatCloud: 'floatCloud 14s ease-in-out infinite',
        shimmerWater: 'shimmerWater 8s ease-in-out infinite',
        pulseDot: 'pulseDot 1.2s ease-in-out infinite',
        rotatePhone: 'rotatePhone 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
