/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#0a0506',
        abyss: '#14090b',
        panel: '#1f0c0e',
        panel2: '#2c1114',
        line: 'rgba(255,255,255,0.08)',
        primary: {
          DEFAULT: '#e8262f',
          soft: '#ff8080',
          deep: '#a30f1a'
        },
        flame: {
          DEFAULT: '#ff6a2b',
          soft: '#ffa25e'
        },
        ember: '#ffb454',
        rose: '#fb7185'
      },
      fontFamily: {
        display: ['"Sora"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 40px rgba(232,38,47,0.35)',
        card: '0 12px 40px rgba(0,0,0,0.45)'
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    }
  },
  plugins: []
}
