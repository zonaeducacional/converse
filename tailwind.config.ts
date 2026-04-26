import type { Config } from 'tailwindcss';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: 'var(--c-brand)',
        surface: 'var(--c-surface)',
        'surface-dark': 'var(--c-surface-dark)',
        muted: 'var(--c-muted)',
        border: 'var(--c-border)',
        online: 'var(--c-online)',
        away: 'var(--c-away)',
        dnd: 'var(--c-dnd)',
        unavail: 'var(--c-unavail)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
