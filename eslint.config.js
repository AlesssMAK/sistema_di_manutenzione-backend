import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  // AdminJS regenerates these on boot; they are build output, not source.
  {
    ignores: ['.adminjs/**'],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node },
    rules: {
      semi: 'error',
      'no-unused-vars': [
        'error',
        {
          args: 'none',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-undef': 'error',
    },
  },
]);
