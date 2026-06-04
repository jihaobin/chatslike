import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@/const/': resolve(__dirname, '../const/src') + '/',
      '@/database/': resolve(__dirname, '../database/src') + '/',
      '@/types/': resolve(__dirname, '../types/src') + '/',
      '@/utils/rbac': resolve(__dirname, '../../src/utils/rbac.ts'),
      '@/utils/': resolve(__dirname, '../utils/src') + '/',
      '@/': resolve(__dirname, '../../src') + '/',
    },
  },
  test: {
    environment: 'node',
  },
});
