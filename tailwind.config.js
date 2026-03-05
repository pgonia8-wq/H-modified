/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 'class' para control manual (agrega .dark al html o body cuando quieras dark)
  // Alternativa: 'media' si prefieres seguir preferencia del sistema automáticamente

  theme: {
    extend: {
      // Colores premium inspirados en tu logo H (carbono/metálico)
      colors: {
        'humans-black': '#000000',
        'humans-dark': '#0A0A0A',
        'humans-darker': '#050505',
        'humans-gray': {
          900: '#111111',
          800: '#1A1A1A',
          700: '#2A2A2A',
          600: '#444444',
          500: '#666666',
          400: '#888888',
          300: '#AAAAAA',
          200: '#CCCCCC',
          100: '#EEEEEE',
        },
        'humans-silver': '#C0C0C0',
        'humans-metal': '#E0E0E0',
        'accent-pink': '#EC4899', // para likes (cálido, humano, diferente al rojo de X)
        'accent-blue': '#3B82F6',
        'accent-green': '#10B981',
        'accent-yellow': '#F59E0B',
      },

      // Fuentes (agrega Inter o Geist vía Google Fonts o local)
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'], // para títulos
        mono: ['JetBrains Mono', 'monospace'],
      },

      // Espaciado más granular y útil
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '128': '32rem',
        '144': '36rem',
      },

      // Breakpoints custom (más allá de los defaults)
      screens: {
        'xs': '475px',
        '3xl': '1920px',
      },

      // Animaciones útiles para premium feel
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'scale-up': 'scaleUp 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleUp: {
          '0%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
      },

      // Box shadows premium (suaves, con glow sutil)
      boxShadow: {
        'premium': '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        'inner-glow': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.05)',
        'metal': '0 4px 15px rgba(192, 192, 192, 0.15)',
      },

      // Border radius más orgánico
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },

      // Backdrop blur para glassmorphism
      backdropBlur: {
        'xs': '2px',
        '3xl': '64px',
      },
    },
  },

  plugins: [
    // Plugins oficiales y populares en 2025-2026 (instálalos con npm)
    require('@tailwindcss/forms'),       // Mejora inputs, selects, checkboxes
    require('@tailwindcss/typography'), // prose class para artículos/posts bonitos
    require('tailwindcss-animate'),     // animate-* utilities (fade, bounce, etc.)
    // Opcional pero recomendado si usas muchos componentes:
    // require('daisyui'),              // temas y componentes listos (pero agrega \~20-30KB)
  ],
      }
