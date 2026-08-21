// Dark-purple design system tokens, ported from the Claude Design handoff
// (design_handoff_friends_tracker/README.md + Friends Tracker Redesign.dc.html).
// Replaces the legacy brand=#6A5ACD/surface=#f5f5f5/Roboto tokens.
//
// Accent is deliberately NOT a flat hex here — it's driven by CSS custom
// properties defined in src/styles/globals.css (--accent, --accent-light,
// --accent-lighter, --accent-grad-from/-to) so re-theming (purple default,
// sanctioned dark-blue #6366F1 alternate) is a one-place edit, not a
// find/replace across every component. `<alpha-value>` lets Tailwind's
// opacity modifiers (bg-accent/16, border-accent/40, ...) keep working.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        bg: '#0E0B14',
        surface: { DEFAULT: '#161020', 2: '#1C1528' },
        input: { DEFAULT: '#211936', 2: '#241B33' },
        modal: '#1A1327',
        hairline: 'rgba(255,255,255,.07)',
        'hairline-strong': 'rgba(255,255,255,.10)',
        text: {
          primary: '#F3F0F8',
          emphasis: '#EDE9FE',
          secondary: '#C9C3D6',
          muted: '#9A93A8',
          faint: '#6B6478',
          faintest: '#5A5468',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          light: 'rgb(var(--accent-light) / <alpha-value>)',
          lighter: 'rgb(var(--accent-lighter) / <alpha-value>)',
        },
        good: '#46D39A',
        soon: '#F5B544',
        bad: '#F4676E',
        category: {
          personal: '#46D39A',
          family: '#A78BFA',
          work: '#F5B544',
          birthday: '#EC4899',
        },
        social: {
          instagram: '#E1306C',
          linkedin: '#0A66C2',
          x: '#EDE9F8',
          email: '#F5B544',
          phone: '#46D39A',
        },
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, var(--accent-grad-from), var(--accent-grad-to))',
        'hero-grad': 'linear-gradient(180deg, #1B1330, #0E0B14)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"Hanken Grotesk"', 'sans-serif'],
      },
      borderRadius: {
        input: '9px',
        card: '14px',
        pill: '20px',
        avatar: '11px',
        'avatar-lg': '22px',
      },
      boxShadow: {
        button: '0 8px 20px -7px rgba(124,58,237,.7), inset 0 1px 0 rgba(255,255,255,.22)',
        'button-sm': '0 6px 16px -6px rgba(124,58,237,.7), inset 0 1px 0 rgba(255,255,255,.22)',
        modal: '0 30px 80px -20px rgba(0,0,0,.7)',
        popup: '0 30px 70px -18px rgba(0,0,0,.7)',
      },
      // calendarView birthday-pulse — page-specific, not a brand token. Retinted
      // to the redesign's birthday category color (#EC4899). The ft* keyframes
      // are the handoff's shared entrance animations (fade/modal/popup/toast) —
      // reused by every modal, popup and toast in the redesign.
      keyframes: {
        'birthday-pulse': {
          '0%, 100%': { boxShadow: '0 4px 15px rgba(236,72,153,.4)' },
          '50%': { boxShadow: '0 6px 20px rgba(236,72,153,.6)', transform: 'translateY(-2px)' },
        },
        ftfade: { from: { opacity: 0 }, to: { opacity: 1 } },
        ftmodal: {
          from: { opacity: 0, transform: 'translateY(12px) scale(.98)' },
          to: { opacity: 1, transform: 'none' },
        },
        ftpop: {
          from: { opacity: 0, transform: 'translateY(14px) scale(.96)' },
          to: { opacity: 1, transform: 'none' },
        },
        fttoast: {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to: { opacity: 1, transform: 'none' },
        },
      },
      animation: {
        'birthday-pulse': 'birthday-pulse 2s infinite',
        ftfade: 'ftfade .25s ease-out',
        ftmodal: 'ftmodal .22s ease-out',
        ftpop: 'ftpop .22s ease-out',
        fttoast: 'fttoast .25s ease-out',
      },
    },
  },
  plugins: [],
};
