// Brand tokens ported from the legacy MPA (nginx/static/*/​*.css — see e.g.
// addFriendForm/addForm.css). Keep these in sync until the Claude Design
// redesign replaces them; every component should reference `brand`/`surface`
// instead of hardcoding these hex values.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6A5ACD',
          dark: '#483D8B',
        },
        surface: '#f5f5f5',
      },
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};