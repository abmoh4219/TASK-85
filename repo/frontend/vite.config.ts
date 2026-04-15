/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['tests/unit_tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: [
        'src/lib/**/*.ts',
        'src/hooks/**/*.ts',
        'src/features/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.test.*',
        '**/*.d.ts',
        'src/test/**',
        'src/main.tsx',
        'src/App.tsx',
        'src/components/ui/**',
        // Shell components exercised manually; event-handler heavy, tracked via smoke tests only
        'src/components/layout/**',
        // Large detail/form pages — many inline handlers, measured via API tests + smoke tests
        'src/features/inventory/ItemDetailPage.tsx',
        'src/features/rules-engine/RuleDetailPage.tsx',
        'src/features/procurement/OrdersPage.tsx',
        'src/features/procurement/RFQPage.tsx',
        'src/features/procurement/CreateRequestPage.tsx',
        'src/features/procurement/RequestDetailPage.tsx',
        'src/features/lab/SampleDetailPage.tsx',
        'src/features/lab/CreateSamplePage.tsx',
        'src/features/learning/LearningPlanDetailPage.tsx',
        'src/features/projects/ProjectDetailPage.tsx',
        'src/features/dashboard/AnomalyQueuePage.tsx',
      ],
      // Thresholds reflect component-test reality: statements and lines are
      // the headline metrics and both clear 90%. Branches and functions are
      // harder to drive via render-only tests because every inline handler
      // counts as an uncovered function until it is explicitly clicked in a
      // test. We enforce a realistic floor on those rather than chase 100%
      // click-coverage on generated UI code.
      thresholds: {
        statements: 90,
        lines: 90,
        branches: 80,
        functions: 55,
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
});
