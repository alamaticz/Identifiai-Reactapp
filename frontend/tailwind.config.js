/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#052e16', // Dark Green (Siohioma Sidebar)
          dark: '#022c22',
          light: '#4ade80', // Bright Green Accent
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#84cc16', // Lime Green
          foreground: '#052e16',
        },
        sidebar: {
          DEFAULT: '#052e16', // Dark Green Background
          foreground: '#e2e8f0', // Light Text
          muted: '#14532d', // Slightly lighter green for hover
          active: '#4ade80', // Active Item Text/Icon
          'active-bg': '#052e16', // Active Item Background (transparent or subtle)
          'active-foreground': '#FFFFFF',
        },
        background: {
          DEFAULT: '#F8FAFC', // Slate 50
          card: '#FFFFFF',
          muted: '#F1F5F9',
        },
        text: {
          primary: '#0f172a', // Slate 900
          secondary: '#475569', // Slate 600
          muted: '#94a3b8', // Slate 400
        },
        success: '#22c55e',
        warning: '#eab308',
        error: '#ef4444',
        info: '#3b82f6',
        border: '#e2e8f0',
        metrics: {
          errors: '#0cb854ff',    // Total Errors Card
          unique: '#0cb854ff',    // Unique Issues Card
          failure: '#0cb854ff',   // Top Rule Failure Card
          ingestion: '#0cb854ff', // Recent Ingestion Card
        }
      }
    },
  },
  plugins: [],
}
