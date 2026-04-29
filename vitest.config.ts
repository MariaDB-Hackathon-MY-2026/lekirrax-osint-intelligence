import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime')
    }
  },
  test: {
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['services/**/*.{test,spec}.{js,ts}', 'node'],
      ['services/**/__tests__/**/*.{js,ts}', 'node'],
      ['database/**/*.{test,spec}.{js,ts}', 'node'],
      ['database/**/__tests__/**/*.{js,ts}', 'node']
    ],
    setupFiles: ['./vitest.setup.ts']
  }
});
