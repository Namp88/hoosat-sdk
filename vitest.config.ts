import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['examples/**', 'dist/**', 'tests/**'],
    },
  },
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, './src/client'),
      '@constants': path.resolve(__dirname, './src/constants'),
      '@crypto': path.resolve(__dirname, './src/crypto'),
      '@enums': path.resolve(__dirname, './src/enums'),
      '@fee': path.resolve(__dirname, './src/fee'),
      '@helpers': path.resolve(__dirname, './src/helpers'),
      '@libs': path.resolve(__dirname, './src/libs'),
      '@models': path.resolve(__dirname, './src/models'),
      '@qr': path.resolve(__dirname, './src/qr'),
      '@streaming': path.resolve(__dirname, './src/streaming'),
      '@transaction': path.resolve(__dirname, './src/transaction'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@wallet': path.resolve(__dirname, './src/wallet'),
    },
  },
});
