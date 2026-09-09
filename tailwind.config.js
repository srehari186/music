/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#080813',
        abyss: '#0e0e1e',
        panel: '#141428',
        panel2: '#1b1b33',
        line: 'rgba(255,255,255,0.08)',
        primary: {
          DEFAULT: '#7c5cff',
          soft: '#9d86ff',
          deep: '#5a3df0'
        },
        aqua: {
          DEFAULT: '#22d3ee',
          soft: '#7ce7f7'
        },
        ember: '#ffb454',
        rose: '#fb7185'
      },
      fontFamily: {
        display: ['"Sora"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 40px rgba(124,92,255,0.35)',
        card: '0 12px 40px rgba(0,0,0,0.45)'
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    }
  },
  plugins: []
}
