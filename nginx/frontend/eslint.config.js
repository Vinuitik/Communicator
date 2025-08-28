// ESLint configuration - catches errors and enforces coding standards
// WHY ESLint? Prevents bugs, enforces consistent code style, catches React-specific issues

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Ignore the build output directory
  { ignores: ['dist'] },
  {
    // Use recommended rules for JavaScript and TypeScript
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    // Apply to TypeScript React files
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,  // Browser APIs like 'window', 'document'
    },
    plugins: {
      // Enforces React Hooks rules (useEffect dependencies, etc.)
      'react-hooks': reactHooks,
      // Ensures components can be hot-reloaded properly
      'react-refresh': reactRefresh,
    },
    rules: {
      // Apply React Hooks rules (prevents infinite loops, missing dependencies)
      ...reactHooks.configs.recommended.rules,
      // Warn if components aren't exported properly for hot reload
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
)
