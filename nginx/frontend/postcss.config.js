// PostCSS configuration - processes CSS after Tailwind generates it
// WHY PostCSS? Adds vendor prefixes (-webkit-, -moz-) for browser compatibility
export default {
  plugins: {
    // Process Tailwind CSS directives (@tailwind base, @tailwind components, etc.)
    tailwindcss: {},
    // Add browser vendor prefixes automatically (like -webkit-transform)
    autoprefixer: {},
  },
}
