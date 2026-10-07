import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Design tokens imported from Figma file ifCw9JuE00PMiaOHgtBxRp (landing-page 6:9)
        cream: '#F5F0EB', // page + light card background
        paper: '#FAF8F5', // alternating section background
        ink: '#1A1A1A', // primary text / dark card / dark buttons
        clay: '#6B6059', // secondary text
        sand: '#B5A08E', // eyebrow text, check icons, accents
        linen: '#EAE3DC', // feature icon tile background
        sandline: '#E3DCD5', // hairline borders
        // Landing CTA accent. Deliberately a deep burnt sienna rather than the
        // stock marketing terracotta: it holds 5.5:1 against cream (AA for the
        // 15px pill label) and reads as clay pigment, not a template accent.
        terracotta: '#A6431C', // primary CTA, accent glyphs, focus rings
        'terracotta-deep': '#8C3413', // CTA hover / pressed
        'terracotta-tint': '#FBEADF', // badge fill behind terracotta text
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        manrope: ['var(--font-manrope)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        fraunces: ['var(--font-fraunces)', 'ui-serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        // Exact Figma effects from the landing-page frame
        'figma-hero': '0 2px 8px 0 rgba(107, 96, 89, 0.05)',
        'figma-pro': '0 8px 24px 0 rgba(107, 96, 89, 0.08)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;

export default config;
