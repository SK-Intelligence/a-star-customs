// ESLint flat config for the storefront (React 18 + strict TypeScript). Run by the Quality gate's
// lint job (`npm run lint`, zero warnings allowed). See CONTRIBUTING.md.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'vite.config.js', 'vite.config.d.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // The classic Rules of Hooks only. eslint-plugin-react-hooks 7's "recommended" preset also
      // enables the React Compiler diagnostics (set-state-in-effect, refs, preserve-manual-
      // memoization...), which describe what the compiler can optimise; this React 18 app does not
      // use the compiler.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // Fast refresh (dev only). CookieConsent.tsx deliberately exports its consent hook beside
      // the components that share its private storage helpers.
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true, allowExportNames: ['useMarketingConsent'] },
      ],
    },
  },
  {
    // Playwright specs and config run in Node, not the browser.
    files: ['e2e/**/*.ts', 'playwright.config.ts', 'vite.config.ts', 'responsive-images.ts', 'test/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
);
