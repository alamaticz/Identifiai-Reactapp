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
          DEFAULT: '#3b82f6', // Bright Blue
          dark: '#1d4ed8',
          light: '#60a5fa',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#8b5cf6', // Violet
          foreground: '#FFFFFF',
        },
        sidebar: {
          DEFAULT: '#1a1f33', // Deep Navy Slate
          foreground: '#94a3b8', // Slate 400
          muted: '#2a2f45', // Lighter Navy
          active: '#3b82f6',
          'active-bg': 'rgba(59, 130, 246, 0.1)',
          'active-foreground': '#FFFFFF',
        },
        background: {
          DEFAULT: '#f8fbff', // Very light blue-ish white
          card: '#FFFFFF',
          muted: '#F1F5F9',
        },
        text: {
          primary: '#1e293b', // Slate 800
          secondary: '#475569', // Slate 600
          muted: '#94a3b8', // Slate 400
        },
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
        border: '#f1f5f9',
        metrics: {
          errors: '#3b82f6',
          unique: '#10b981',
          failure: '#f59e0b',
          ingestion: '#6366f1',
        }
      }
    },
  },
  plugins: [],
}
